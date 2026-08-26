import { analysis, rankings, strategies } from "@/lib/mock-data";
import { isMockStockSymbol, normalizeStockSymbol } from "@/lib/mock-symbols";

export async function getAnalysis(symbol = "FPT") {
  const normalized = normalizeStockSymbol(symbol);
  if (!isMockStockSymbol(normalized)) return null;
  if (normalized === analysis.symbol) return analysis;

  const ranking = rankings.find((item) => item.symbol === normalized);
  const holding = strategies.flatMap((strategy) => strategy.allocation).find((item) => item.symbol === normalized);
  const company = ranking?.company ?? holding?.company ?? normalized;
  const price = ranking?.price ?? 0;
  const change = ranking?.change ?? holding?.change ?? 0;
  const score = ranking?.score ?? 70;

  return {
    ...analysis,
    symbol: normalized,
    company,
    price,
    change,
    score,
    summary: `${company} is included in the current synthetic research universe. The full company-specific evidence model will replace this placeholder in Phase 4.`,
  };
}
