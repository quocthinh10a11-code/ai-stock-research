import { analysis, rankings, strategies } from "@/lib/mock-data";

const symbols = new Set([
  analysis.symbol,
  ...rankings.map((item) => item.symbol),
  ...strategies.flatMap((strategy) => strategy.allocation.map((item) => item.symbol)),
]);

export const mockStockSymbols = Array.from(symbols).sort();

export function normalizeStockSymbol(value: string) {
  return value.trim().toUpperCase();
}

export function isMockStockSymbol(value: string) {
  return symbols.has(normalizeStockSymbol(value));
}
