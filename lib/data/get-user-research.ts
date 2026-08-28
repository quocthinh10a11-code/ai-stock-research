import { createClient } from "@/lib/supabase/server";

export async function getUserWatchlist() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from("user_watchlist").select("symbol").eq("user_id", user.id);
  if (error) return [];
  return data.map((item) => item.symbol as string);
}
