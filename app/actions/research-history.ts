"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeStockSymbol } from "@/lib/market-universe";

export async function recordResearchView(symbol: string) {
  const normalized = normalizeStockSymbol(symbol);
  if (!/^[A-Z0-9]{2,10}$/.test(normalized)) return { ok: false };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from("research_history").insert({ user_id: user.id, symbol: normalized });
  return { ok: !error };
}
