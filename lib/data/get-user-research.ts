import { createClient } from "@/lib/supabase/server";

export async function getUserWatchlist() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from("user_watchlist").select("symbol").eq("user_id", user.id);
  if (error) return [];
  return data.map((item) => item.symbol as string);
}

export async function getUserPortfolioSelection() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("user_portfolio_selection").select("strategy_type").eq("user_id", user.id).maybeSingle();
  if (error) return null;
  return data?.strategy_type as string | undefined ?? null;
}
