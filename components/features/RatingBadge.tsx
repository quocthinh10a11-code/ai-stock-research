import { cn } from "@/lib/utils";
import type { RankingItem } from "@/types/stock";
export function RatingBadge({ rating }: { rating: RankingItem["rating"] }) { return <span className={cn("inline-flex min-w-20 justify-center rounded px-2 py-1 font-display text-[11px] font-semibold", rating === "Strong Buy" && "bg-emerald-100 text-emerald-800", rating === "Buy" && "bg-green-50 text-green-700", rating === "Neutral" && "bg-amber-50 text-amber-700", rating === "Sell" && "bg-red-50 text-red-700")}>{rating}</span>; }
