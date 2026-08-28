import type { InvestmentAction, InvestmentDecisionRow } from "@/types/stock";

const groups = [
  ["business_performance", "Hiệu quả kinh doanh", ["EPS", "ROE"]],
  ["valuation", "Định giá", ["P/E", "P/B", "PEG"]],
  ["financial_health", "Sức khỏe tài chính", ["D/E", "FCF"]],
  ["risk_momentum", "Rủi ro & tín hiệu sóng", ["Beta", "Dividend Yield"]],
] as const;

const actions = new Set<InvestmentAction>(["buy", "accumulate", "hold", "reduce", "sell", "insufficient_data"]);

export function normalizeDecisionMatrix(value: unknown, sourceCount: number): InvestmentDecisionRow[] {
  const rows = Array.isArray(value) ? value : [];
  return groups.map(([group, title, fallbackMetrics]) => {
    const raw = rows.find((item) => item && typeof item === "object" && (item as Record<string, unknown>).group === group) as Record<string, unknown> | undefined;
    const rawMetrics = Array.isArray(raw?.metrics) ? raw.metrics : [];
    const metrics = rawMetrics.length ? rawMetrics.flatMap((metric) => {
      if (!metric || typeof metric !== "object") return [];
      const item = metric as Record<string, unknown>;
      const name = String(item.name ?? "").slice(0, 40);
      if (!name) return [];
      const references = Array.isArray(item.sourceIndices)
        ? item.sourceIndices.map(Number).filter((index) => Number.isInteger(index) && index >= 1 && index <= sourceCount)
        : [];
      return [{ name, value: item.value == null ? null : String(item.value).slice(0, 80), trend: item.trend == null ? null : String(item.trend).slice(0, 160), sourceIndices: references }];
    }) : fallbackMetrics.map((name) => ({ name, value: null, trend: null, sourceIndices: [] }));
    const requestedAction = String(raw?.action ?? "insufficient_data") as InvestmentAction;
    const action = actions.has(requestedAction) ? requestedAction : "insufficient_data";
    const requestedConfidence = raw?.confidence;
    const confidence = requestedConfidence === "high" || requestedConfidence === "medium" ? requestedConfidence : "low";
    return {
      group,
      title,
      metrics,
      analysis: String(raw?.analysis ?? "Chưa có đủ dữ liệu có thể kiểm chứng cho nhóm chỉ số này.").slice(0, 900),
      action,
      confidence,
      rationale: String(raw?.rationale ?? "Cần bổ sung dữ liệu trước khi đưa ra tín hiệu.").slice(0, 500),
    };
  });
}
