import { normalizeStockSymbol } from "@/lib/market-universe";
import { buildFreshness } from "@/lib/freshness";
import { createPublicDataClient } from "@/lib/supabase/public-data";
import type { EvidenceItem, FinancialPeriod, RelatedStock, StockAnalysis } from "@/types/stock";

const signalLabels: Record<string, string> = {
  sma20: "SMA 20",
  sma50: "SMA 50",
  ema20: "EMA 20",
  ema50: "EMA 50",
  rsi14: "RSI 14",
  atr14: "ATR 14",
  volume_ma20: "Volume MA 20",
  relative_volume: "Relative volume",
};

function formatSignal(name: string, value: number) {
  if (name === "rsi14") return value.toFixed(1);
  if (name === "relative_volume") return `${value.toFixed(2)}×`;
  if (name === "volume_ma20") return Math.round(value).toLocaleString("vi-VN");
  return `${Math.round(value).toLocaleString("vi-VN")} ₫`;
}

export async function getAnalysis(symbol = "FPT"): Promise<StockAnalysis | null> {
  const normalized = normalizeStockSymbol(symbol);
  if (!/^[A-Z0-9]{2,10}$/.test(normalized)) return null;
  const supabase = createPublicDataClient();
  if (!supabase) return null;

  const { data: stock } = await supabase.from("stocks").select("symbol,company_name,sector,exchange,updated_at").eq("symbol", normalized).maybeSingle();
  if (!stock) return null;

  const { data: snapshot } = await supabase.from("latest_market_snapshots").select("symbol,company_name,close,previous_close,bias,price_date,price_provider_timestamp,price_fetched_at,price_expires_at,price_source_name,price_source_url,price_data_quality,price_last_error,price_refresh_status,technical_provider_timestamp,technical_fetched_at,technical_expires_at,technical_source_name,technical_source_url,technical_data_quality,technical_last_error,technical_refresh_status").eq("symbol", normalized).maybeSingle();

  const { data: synthesis } = await supabase.from("agent_analysis").select("summary_text").eq("symbol", normalized).order("analysis_date", { ascending: false }).limit(1).maybeSingle();
  const { data: signals } = await supabase.from("evidence_snapshots").select("signal_name,signal_value,signal_direction,source,date").eq("symbol", normalized).order("date", { ascending: false }).limit(8);
  const { data: financialRows } = await supabase.from("financial_periods").select("period_label,period_end,revenue,gross_profit,operating_profit,profit_before_tax,net_profit,eps,total_assets,total_liabilities,equity,operating_cash_flow,unit,provider_timestamp,fetched_at,expires_at,source_name,source_url,data_quality,last_error,refresh_status").eq("symbol", normalized).eq("period_type", "quarter").not("period_end", "is", null).order("period_end", { ascending: false }).limit(20);
  const { data: relatedRows } = await supabase.from("stocks").select("symbol,company_name,exchange").eq("sector", stock.sector).neq("symbol", normalized).limit(5);
  const relatedSymbols = (relatedRows ?? []).map((row) => row.symbol);
  const { data: relatedSnapshots } = relatedSymbols.length ? await supabase.from("latest_market_snapshots").select("symbol,close,previous_close").in("symbol", relatedSymbols) : { data: [] };
  const relatedPrice = new Map((relatedSnapshots ?? []).map((row) => [row.symbol, row]));

  const price = snapshot?.close == null ? null : Number(snapshot.close);
  const previous = snapshot?.previous_close == null ? price : Number(snapshot.previous_close);
  const change = price != null && previous ? Number((((price - previous) / previous) * 100).toFixed(2)) : null;
  const score = snapshot?.bias === "bullish" ? 85 : snapshot?.bias === "bearish" ? 30 : 55;
  const latestFinancial = financialRows?.[0];
  const evidence: EvidenceItem[] = (signals ?? []).map((signal) => ({
    label: signalLabels[signal.signal_name] ?? signal.signal_name,
    value: formatSignal(signal.signal_name, Number(signal.signal_value)),
    detail: `${signal.source} · ${signal.date}`,
    tone: signal.signal_direction === "supporting" ? "positive" : "negative",
  }));

  return {
    symbol: stock.symbol,
    company: stock.company_name,
    sector: stock.sector,
    exchange: stock.exchange,
    price,
    change,
    score,
    summary: synthesis?.summary_text ?? "Rule-based analysis has not been generated for this symbol yet.",
    evidence,
    financials: [...(financialRows ?? [])].reverse().map((row) => ({
      period: row.period_label,
      periodEnd: String(row.period_end),
      revenue: row.revenue == null ? null : Number(row.revenue),
      grossProfit: row.gross_profit == null ? null : Number(row.gross_profit),
      operatingProfit: row.operating_profit == null ? null : Number(row.operating_profit),
      profitBeforeTax: row.profit_before_tax == null ? null : Number(row.profit_before_tax),
      netProfit: row.net_profit == null ? null : Number(row.net_profit),
      eps: row.eps == null ? null : Number(row.eps),
      totalAssets: row.total_assets == null ? null : Number(row.total_assets),
      totalLiabilities: row.total_liabilities == null ? null : Number(row.total_liabilities),
      equity: row.equity == null ? null : Number(row.equity),
      operatingCashFlow: row.operating_cash_flow == null ? null : Number(row.operating_cash_flow),
      unit: row.unit,
    } satisfies FinancialPeriod)),
    related: (relatedRows ?? []).map((row) => {
      const market = relatedPrice.get(row.symbol);
      const relatedClose = market?.close == null ? null : Number(market.close);
      const relatedPrevious = market?.previous_close == null ? relatedClose : Number(market.previous_close);
      return {
        symbol: row.symbol,
        company: row.company_name,
        exchange: row.exchange,
        price: relatedClose,
        change: relatedClose != null && relatedPrevious ? Number((((relatedClose - relatedPrevious) / relatedPrevious) * 100).toFixed(2)) : null,
      } satisfies RelatedStock;
    }),
    updatedAt: snapshot?.price_date ?? stock.updated_at,
    marketFreshness: buildFreshness({
      kind: "market",
      providerTimestamp: snapshot?.price_provider_timestamp ?? snapshot?.price_date ?? null,
      fetchedAt: snapshot?.price_fetched_at ?? null,
      expiresAt: snapshot?.price_expires_at ?? null,
      sourceName: snapshot?.price_source_name ?? "vnstock-community-v4",
      sourceUrl: snapshot?.price_source_url ?? null,
      dataQuality: snapshot?.price_data_quality ?? "unknown",
      lastError: snapshot?.price_last_error ?? null,
      refreshStatus: snapshot?.price_refresh_status ?? null,
    }),
    technicalFreshness: buildFreshness({
      kind: "technical",
      providerTimestamp: snapshot?.technical_provider_timestamp ?? snapshot?.price_date ?? null,
      fetchedAt: snapshot?.technical_fetched_at ?? null,
      expiresAt: snapshot?.technical_expires_at ?? null,
      sourceName: snapshot?.technical_source_name ?? "vnstock-community-v4/rule-based-indicators",
      sourceUrl: snapshot?.technical_source_url ?? null,
      dataQuality: snapshot?.technical_data_quality ?? "unknown",
      lastError: snapshot?.technical_last_error ?? null,
      refreshStatus: snapshot?.technical_refresh_status ?? null,
    }),
    fundamentalsFreshness: buildFreshness({
      kind: "fundamentals",
      providerTimestamp: latestFinancial?.provider_timestamp ?? latestFinancial?.period_end ?? null,
      fetchedAt: latestFinancial?.fetched_at ?? null,
      expiresAt: latestFinancial?.expires_at ?? null,
      sourceName: latestFinancial?.source_name ?? "vnstock-community",
      sourceUrl: latestFinancial?.source_url ?? null,
      dataQuality: latestFinancial?.data_quality ?? "unknown",
      lastError: latestFinancial?.last_error ?? null,
      refreshStatus: latestFinancial?.refresh_status ?? null,
    }),
  };
}
