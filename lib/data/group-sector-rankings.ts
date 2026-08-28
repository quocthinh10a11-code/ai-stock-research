import type { RankingItem } from "@/types/stock";
import { sectorNames } from "../sector-taxonomy.ts";

export interface SectorRankingGroup {
  sector: string;
  items: RankingItem[];
}

function compareRankings(a: RankingItem, b: RankingItem) {
  return Number(b.eligible) - Number(a.eligible) || b.score - a.score || b.change - a.change || a.symbol.localeCompare(b.symbol);
}

export function groupTopFiveBySector(items: RankingItem[]): SectorRankingGroup[] {
  const grouped = new Map<string, RankingItem[]>();

  for (const item of items) {
    const sector = item.sector.trim() || "Chưa phân loại";
    grouped.set(sector, [...(grouped.get(sector) ?? []), item]);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => {
      if (a === "Chưa phân loại") return 1;
      if (b === "Chưa phân loại") return -1;
      const aIndex = sectorNames.indexOf(a);
      const bIndex = sectorNames.indexOf(b);
      if (aIndex >= 0 || bIndex >= 0) return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
      return a.localeCompare(b, "vi");
    })
    .map(([sector, sectorItems]) => ({
      sector,
      items: sectorItems.sort(compareRankings).slice(0, 5),
    }));
}
