"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const strategyTypes = ["growth", "dividend", "value", "defensive"] as const;
export type StrategyType = typeof strategyTypes[number];

export async function savePortfolioSelection(strategyType: string) {
  if (!strategyTypes.includes(strategyType as StrategyType)) return { ok: false, message: "Unknown portfolio strategy." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in again to save this strategy." };
  const { error } = await supabase.from("user_portfolio_selection").upsert({ user_id: user.id, strategy_type: strategyType, selected_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, message: "Could not save strategy. Apply the latest Supabase migration and try again." };
  revalidatePath("/portfolio");
  return { ok: true, message: "Portfolio strategy saved." };
}
