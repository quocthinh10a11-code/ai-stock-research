import { extractFinancialWeb, searchFinancialWeb, type WebResearchSource } from "./tavily-search.ts";

const metricKeys = new Set(["revenue", "gross_profit", "operating_profit", "profit_before_tax", "net_profit", "eps", "roe", "pe", "pb", "peg", "debt_to_equity", "operating_cash_flow", "capex", "fcf", "beta", "dividend_yield", "total_assets", "total_liabilities", "equity"]);

export type LiveFinancialFact = {
  metric: string;
  label: string;
  value: string;
  period: string | null;
  unit: string | null;
  sourceIndex: number;
  page: number | null;
  evidence: string;
  confidence: "medium" | "high";
};

export type LiveFinancialResearchResult =
  | { ok: true; sources: WebResearchSource[]; warnings: string[] }
  | { ok: false; status: number; message: string; detail: string };

function searchText(value: string) {
  return value.toLocaleLowerCase("vi-VN").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
}

export function filterEntitySources(sources: WebResearchSource[], symbol: string, company: string, exchange: string) {
  const normalizedSymbol = symbol.toLowerCase();
  const companyTokens = searchText(company).split(/[^a-z0-9]+/).filter((token) => token.length > 1 && !["cong", "ty", "co", "phan", "tap", "doan", "tong", "congty", "ctcp"].includes(token));
  return sources.filter((source) => {
    const title = searchText(source.title);
    const content = searchText(source.content);
    const hostname = new URL(source.url).hostname.toLowerCase().replace(/^www\./, "");
    const companyMatches = companyTokens.filter((token) => `${title} ${content}`.includes(token)).length >= Math.min(2, companyTokens.length);
    const symbolTitle = new RegExp(`(^|[^a-z0-9])${normalizedSymbol}([^a-z0-9]|$)`, "i").test(title);
    const exchangeSymbol = title.includes(`${exchange.toLowerCase()}:${normalizedSymbol}`);
    const wrongExchangeSymbol = ["hose", "hnx", "upcom"].some((candidate) => candidate !== exchange.toLowerCase() && title.includes(`${candidate}:${normalizedSymbol}`));
    const officialExchange = /(^|\.)(hnx\.vn|hsx\.vn|hose\.vn)$/.test(hostname) && new RegExp(`(^|[^a-z0-9])${normalizedSymbol}([^a-z0-9]|$)`, "i").test(content);
    const companyDomain = hostname === `${normalizedSymbol}.com.vn` || hostname.endsWith(`.${normalizedSymbol}.com.vn`);
    if (wrongExchangeSymbol) return false;
    return companyMatches || officialExchange || (symbolTitle && (exchangeSymbol || companyDomain));
  });
}

function evidenceKey(value: string) {
  return value.toLocaleLowerCase("vi-VN").replace(/[^\p{L}\p{N}%.,/-]+/gu, " ").replace(/\s+/g, " ").trim();
}

export function normalizeFinancialFacts(value: unknown, sources: WebResearchSource[]): LiveFinancialFact[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const metric = String(item.metric ?? "").toLowerCase().trim();
    const sourceIndex = Number(item.sourceIndex);
    const evidence = String(item.evidence ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
    const factValue = String(item.value ?? "").trim().slice(0, 120);
    if (!metricKeys.has(metric) || !factValue || !evidence || !Number.isInteger(sourceIndex) || sourceIndex < 1 || sourceIndex > sources.length) return [];
    const period = item.period == null ? null : String(item.period).trim().slice(0, 80) || null;
    const unit = item.unit == null ? null : String(item.unit).trim().slice(0, 80) || null;
    const key = `${metric}:${period}:${sourceIndex}:${factValue}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const pageNumber = Number(item.page);
    const page = Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : null;
    const source = sources[sourceIndex - 1];
    const evidenceMatchesText = evidenceKey(source.content).includes(evidenceKey(evidence));
    const evidencePointsToPdfPage = source.documentType === "pdf" && page != null;
    if (!evidenceMatchesText && !evidencePointsToPdfPage) return [];
    return [{
      metric,
      label: String(item.label ?? metric).trim().slice(0, 80),
      value: factValue,
      period,
      unit,
      sourceIndex,
      page,
      evidence,
      confidence: item.confidence === "high" ? "high" as const : "medium" as const,
    }];
  }).slice(0, 40);
}

export async function runLiveFinancialResearch({
  tavilyKey,
  symbol,
  company,
  exchange,
}: {
  tavilyKey: string;
  symbol: string;
  company: string;
  exchange: string;
}): Promise<LiveFinancialResearchResult> {
  const [statementsSearch, metricsSearch] = await Promise.all([
    searchFinancialWeb({ apiKey: tavilyKey, symbol, company, exchange, intent: "statements" }),
    searchFinancialWeb({ apiKey: tavilyKey, symbol, company, exchange, intent: "metrics" }),
  ]);
  if (!statementsSearch.ok && !metricsSearch.ok) {
    return { ok: false, status: [429, 432, 433].includes(statementsSearch.status ?? 0) ? 429 : 502, message: statementsSearch.message, detail: statementsSearch.detail };
  }
  const successfulSearches = [];
  if (statementsSearch.ok) successfulSearches.push(statementsSearch);
  if (metricsSearch.ok) successfulSearches.push(metricsSearch);
  const merged = new Map<string, WebResearchSource>();
  const maxResults = Math.max(...successfulSearches.map((result) => result.results.length));
  for (let index = 0; index < maxResults; index += 1) {
    for (const result of successfulSearches) {
      const source = result.results[index];
      if (source && !merged.has(source.url)) merged.set(source.url, source);
    }
  }
  if (exchange === "HNX") {
    const officialUrl = `https://chonds.hnx.vn/vi-vn/cophieu-etfs/chi-tiet-chung-khoan-ny-${symbol.toLowerCase()}.html`;
    if (!merged.has(officialUrl)) merged.set(officialUrl, { title: `${symbol} — ${company} | HNX`, url: officialUrl, content: `${symbol} ${company} ${exchange} công bố thông tin báo cáo tài chính`, publishedAt: null, source: "chonds.hnx.vn", documentType: "html" });
  }
  const entitySources = filterEntitySources([...merged.values()], symbol, company, exchange);
  if (!entitySources.length) return { ok: false, status: 404, message: `Không tìm thấy nguồn tài chính đúng thực thể ${symbol}.`, detail: "No entity-matched search results" };

  const warnings: string[] = [];
  const extracted = await extractFinancialWeb({ apiKey: tavilyKey, sources: entitySources, symbol });
  const sources = extracted.ok && extracted.results.length ? extracted.results : entitySources.slice(0, 5);
  if (!extracted.ok) warnings.push("Không đọc được toàn văn một số trang; agent đã dùng excerpt tìm kiếm.");

  return { ok: true, sources, warnings };
}
