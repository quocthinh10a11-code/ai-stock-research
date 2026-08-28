import assert from "node:assert/strict";
import test from "node:test";
import { groupTopFiveBySector } from "../lib/data/group-sector-rankings.ts";
import type { RankingItem } from "../types/stock.ts";

function ranking(symbol: string, sector: string, score: number, change: number): RankingItem {
  return {
    rank: 0,
    symbol,
    company: symbol,
    sector,
    price: 10_000,
    change,
    score,
    rating: "Buy",
  };
}

test("groups rankings by sector and keeps the best five in each group", () => {
  const items = [
    ranking("BANK6", "Ngân hàng", 50, 1),
    ranking("BANK3", "Ngân hàng", 80, 1),
    ranking("BANK1", "Ngân hàng", 90, 1),
    ranking("BANK2", "Ngân hàng", 80, 2),
    ranking("BANK4", "Ngân hàng", 70, 1),
    ranking("BANK5", "Ngân hàng", 60, 1),
    ranking("TECH1", "Công nghệ", 75, 1),
  ];

  const groups = groupTopFiveBySector(items);

  assert.deepEqual(groups.map((group) => group.sector), ["Công nghệ", "Ngân hàng"]);
  assert.deepEqual(groups[1].items.map((item) => item.symbol), ["BANK1", "BANK2", "BANK3", "BANK4", "BANK5"]);
});

test("puts blank sectors in a final fallback group", () => {
  const groups = groupTopFiveBySector([
    ranking("UNKNOWN", " ", 60, 0),
    ranking("FPT", "Công nghệ", 90, 1),
  ]);

  assert.deepEqual(groups.map((group) => group.sector), ["Công nghệ", "Chưa phân loại"]);
});
