import type { RankingItem } from "@/types/stock";

export interface SectorRankingGroup {
  sector: string;
  items: RankingItem[];
}

function compareRankings(a: RankingItem, b: RankingItem) {
  return b.score - a.score || b.change - a.change || a.symbol.localeCompare(b.symbol);
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
      return a.localeCompare(b, "vi");
    })
    .map(([sector, sectorItems]) => ({
      sector,
      items: sectorItems.sort(compareRankings).slice(0, 5),
    }));
}
