import { NextResponse } from "next/server";
import { getAnalysis } from "@/lib/data/get-analysis";
import { requestGroundedGemini } from "@/lib/gemini-provider";
import { normalizeStockSymbol } from "@/lib/market-universe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createPublicDataClient } from "@/lib/supabase/public-data";
import type { GroundedResearch, MarketBias, TrendForecast } from "@/types/stock";

const cacheMinutes = 15;

function clampProbability(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0;
}

function normalizeForecast(value: unknown, horizon: TrendForecast["horizon"]): TrendForecast {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const direction: MarketBias = raw.direction === "bullish" || raw.direction === "bearish" ? raw.direction : "neutral";
  let bullish = clampProbability(raw.bullishProbability);
  let neutral = clampProbability(raw.neutralProbability);
  let bearish = clampProbability(raw.bearishProbability);
  const total = bullish + neutral + bearish || 100;
  bullish = Math.round((bullish / total) * 100);
  neutral = Math.round((neutral / total) * 100);
  bearish = 100 - bullish - neutral;
  return { horizon, direction, bullishProbability: bullish, neutralProbability: neutral, bearishProbability: bearish, rationale: String(raw.rationale ?? "Insufficient evidence for a stronger scenario.") };
}

function reportFromRow(row: Record<string, unknown>, cached: boolean): GroundedResearch {
  return {
    summary: String(row.summary_text),
    outlook: String(row.outlook_text),
    catalysts: Array.isArray(row.catalysts_json) ? row.catalysts_json.map(String) : [],
    risks: Array.isArray(row.risks_json) ? row.risks_json.map(String) : [],
    forecasts: Array.isArray(row.forecast_json) ? row.forecast_json as TrendForecast[] : Object.values((row.forecast_json ?? {}) as Record<string, TrendForecast>),
    citations: Array.isArray(row.citations_json) ? row.citations_json as GroundedResearch["citations"] : [],
    asOf: String(row.as_of),
    cached,
    model: String(row.model),
  };
}

export async function POST(_: Request, context: { params: Promise<{ symbol: string }> }) {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in to run live research." }, { status: 401 });

  const { symbol: rawSymbol } = await context.params;
  const symbol = normalizeStockSymbol(rawSymbol);
  if (!/^[A-Z0-9]{2,10}$/.test(symbol)) return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
  const analysis = await getAnalysis(symbol);
  if (!analysis) return NextResponse.json({ error: "Ticker not found on HOSE, HNX or UPCOM." }, { status: 404 });

  const publicClient = createPublicDataClient();
  const cutoff = new Date(Date.now() - cacheMinutes * 60_000).toISOString();
  if (publicClient) {
    const { data: cached } = await publicClient.from("ai_research_reports").select("*").eq("symbol", symbol).gte("expires_at", new Date().toISOString()).gte("requested_at", cutoff).order("requested_at", { ascending: false }).limit(1).maybeSingle();
    if (cached) {
      const cachedReport = reportFromRow(cached, true);
      if (cachedReport.citations.length > 0) return NextResponse.json(cachedReport);
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Realtime AI is not configured. Add GEMINI_API_KEY in Vercel." }, { status: 503 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "AI cache is not configured. Add SUPABASE_SECRET_KEY in Vercel." }, { status: 503 });
  const configuredLimit = Number(process.env.AI_DAILY_REQUEST_LIMIT ?? "450");
  const dailyLimit = Number.isInteger(configuredLimit) && configuredLimit > 0 ? Math.min(configuredLimit, 500) : 450;
  const { data: reserved, error: quotaError } = await admin.rpc("reserve_ai_research_request", { p_limit: dailyLimit });
  if (quotaError) {
    console.error("AI quota reservation failed", quotaError.message);
    return NextResponse.json({ error: "The live research quota could not be verified. Please retry." }, { status: 503 });
  }
  if (!reserved) return NextResponse.json({ error: "The free daily AI research budget has been reached. Try again tomorrow." }, { status: 429 });
  const financialContext = analysis.financials.map((period) => ({ period: period.period, revenue: period.revenue, grossProfit: period.grossProfit, netProfit: period.netProfit, eps: period.eps, unit: period.unit }));
  const asOf = new Date().toISOString();
  const prompt = `You are a cautious Vietnamese equity research assistant. Research ${analysis.symbol} (${analysis.company}, ${analysis.exchange}, sector ${analysis.sector}) using current web sources as of ${asOf}. Prefer exchange filings, company investor-relations pages, audited reports, and reputable Vietnamese financial news. Never invent a number. Distinguish facts from scenarios. This is not investment advice.\n\nStructured data already available: ${JSON.stringify({ price: analysis.price, changePct: analysis.change, technicalEvidence: analysis.evidence, quarterlyFinancials: financialContext })}\n\nReturn ONLY valid JSON with this shape: {"summary":"3-5 factual sentences","outlook":"balanced forward-looking synthesis","catalysts":["..."],"risks":["..."],"forecasts":[{"horizon":"1M","direction":"bullish|neutral|bearish","bullishProbability":0,"neutralProbability":0,"bearishProbability":0,"rationale":"..."},{"horizon":"3M",...},{"horizon":"6M",...}]}. Probabilities in each horizon must sum to 100. Forecasts are scenarios based on evidence, not promises or price targets.`;
  const provider = await requestGroundedGemini({ apiKey, prompt });
  if (!provider.ok) {
    console.error("Gemini research failed", {
      attemptedModels: provider.attemptedModels,
      providerStatus: provider.error.providerStatus,
      detail: provider.error.detail.slice(0, 500),
    });
    return NextResponse.json({ error: provider.error.message }, { status: provider.error.httpStatus });
  }
  const { model, response } = provider;
  let body: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } }> };
  try { body = await response.json(); }
  catch { return NextResponse.json({ error: "Live research returned an invalid provider response. Please retry." }, { status: 502 }); }
  const candidate = body.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "")); }
  catch { return NextResponse.json({ error: "Live research returned an unreadable response. Please retry." }, { status: 502 }); }
  const rawForecasts = Array.isArray(parsed.forecasts) ? parsed.forecasts : [];
  const forecasts = (["1M", "3M", "6M"] as const).map((horizon, index) => normalizeForecast(rawForecasts[index], horizon));
  const citations = (candidate?.groundingMetadata?.groundingChunks ?? []).flatMap((chunk) => {
    if (!chunk.web?.uri) return [];
    try { const hostname = new URL(chunk.web.uri).hostname; return [{ title: chunk.web.title ?? hostname, url: chunk.web.uri, source: hostname }]; }
    catch { return []; }
  }).slice(0, 8);
  if (citations.length === 0) return NextResponse.json({ error: "The model returned no verifiable web sources, so the insight was discarded." }, { status: 502 });
  const report: GroundedResearch = {
    summary: String(parsed.summary ?? "No grounded summary was returned."),
    outlook: String(parsed.outlook ?? "No grounded outlook was returned."),
    catalysts: Array.isArray(parsed.catalysts) ? parsed.catalysts.map(String).slice(0, 6) : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.map(String).slice(0, 6) : [],
    forecasts,
    citations,
    asOf,
    cached: false,
    model,
  };
  const { error: cacheError } = await admin.from("ai_research_reports").insert({ symbol, as_of: asOf, model, summary_text: report.summary, outlook_text: report.outlook, catalysts_json: report.catalysts, risks_json: report.risks, forecast_json: report.forecasts, citations_json: report.citations, expires_at: new Date(Date.now() + cacheMinutes * 60_000).toISOString() });
  if (cacheError) console.error("AI research cache write failed", cacheError.message);
  return NextResponse.json(report);
}
