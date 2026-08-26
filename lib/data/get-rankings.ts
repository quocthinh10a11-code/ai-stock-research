import { createPublicDataClient } from "@/lib/supabase/public-data";
import type { RankingItem } from "@/types/stock";

function ratingForScore(score: number): RankingItem["rating"] {
  if (score >= 80) return "Strong Buy";
  if (score >= 65) return "Buy";
  if (score >= 40) return "Neutral";
  return "Sell";
}

export async function getRankings(): Promise<RankingItem[]> {
  const supabase = createPublicDataClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("latest_market_snapshots").select("symbol,company_name,sector,close,previous_close,bias,rsi14,relative_volume,ema20,ema50").not("close", "is", null);
  if (error || !data) return [];

  return data.map((row) => {
    const price = Number(row.close);
    const previous = Number(row.previous_close ?? row.close);
    const change = previous ? Number((((price - previous) / previous) * 100).toFixed(2)) : 0;
    const score = row.bias === "bullish" ? 85 : row.bias === "bearish" ? 30 : 55;
    const ema20 = Number(row.ema20 ?? 0);
    const ema50 = Number(row.ema50 ?? 0);
    return {
      rank: 0,
      symbol: row.symbol,
      company: row.company_name,
      sector: row.sector,
      price,
      change,
      score,
      rating: ratingForScore(score),
      rsi14: row.rsi14 == null ? undefined : Number(Number(row.rsi14).toFixed(1)),
      relativeVolume: row.relative_volume == null ? undefined : Number(Number(row.relative_volume).toFixed(2)),
      trend: ema20 > ema50 ? "Bullish" : ema20 < ema50 ? "Bearish" : "Flat",
    } satisfies RankingItem;
  }).sort((a, b) => b.score - a.score || b.change - a.change).map((item, index) => ({ ...item, rank: index + 1 }));
}
