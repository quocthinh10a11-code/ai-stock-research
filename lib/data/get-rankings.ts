import { createPublicDataClient } from "@/lib/supabase/public-data";
import type { RankingItem, ScreenerCriterion } from "@/types/stock";

function ratingForScore(score: number): RankingItem["rating"] {
  if (score >= 80) return "Strong Buy";
  if (score >= 65) return "Buy";
  if (score >= 40) return "Neutral";
  return "Sell";
}

function fallbackSector(value: string) {
  const aliases: Record<string, string> = {
    Financials: "Tài chính",
    "Real Estate": "Tài chính",
    Materials: "Vật liệu cơ bản",
    Technology: "Công nghệ thông tin",
    Retail: "Dịch vụ tiêu dùng",
    Consumer: "Hàng tiêu dùng",
  };
  return aliases[value] ?? value;
}

export async function getRankings(): Promise<RankingItem[]> {
  const supabase = createPublicDataClient();
  if (!supabase) return [];
  const { data: screened, error: screenedError } = await supabase
    .from("latest_sector_screenings")
    .select("symbol,company_name,sector_group,industry,exchange,price,change_pct,market_cap,average_volume20,pe,roe,revenue_growth,profit_growth,debt_to_equity,score,passed_criteria,available_criteria,eligible,criteria_json,as_of")
    .not("price", "is", null);

  if (!screenedError && screened?.length) {
    return screened.map((row) => ({
      rank: 0,
      symbol: String(row.symbol),
      company: String(row.company_name),
      sector: String(row.sector_group),
      industry: String(row.industry),
      exchange: row.exchange as RankingItem["exchange"],
      price: Number(row.price),
      change: Number(Number(row.change_pct ?? 0).toFixed(2)),
      score: Number(row.score),
      rating: ratingForScore(Number(row.score)),
      marketCap: row.market_cap == null ? undefined : Number(row.market_cap),
      averageVolume20: row.average_volume20 == null ? undefined : Number(row.average_volume20),
      pe: row.pe == null ? undefined : Number(row.pe),
      roe: row.roe == null ? undefined : Number(row.roe),
      revenueGrowth: row.revenue_growth == null ? undefined : Number(row.revenue_growth),
      profitGrowth: row.profit_growth == null ? undefined : Number(row.profit_growth),
      debtToEquity: row.debt_to_equity == null ? undefined : Number(row.debt_to_equity),
      passedCriteria: Number(row.passed_criteria),
      availableCriteria: Number(row.available_criteria),
      eligible: Boolean(row.eligible),
      screenedAt: String(row.as_of),
      criteria: Array.isArray(row.criteria_json) ? row.criteria_json as ScreenerCriterion[] : [],
    } satisfies RankingItem))
      .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || b.change - a.change)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }

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
      sector: fallbackSector(row.sector),
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
