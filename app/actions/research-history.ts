"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeStockSymbol } from "@/lib/market-universe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function recordResearchView(symbol: string) {
  const normalized = normalizeStockSymbol(symbol);
  if (!/^[A-Z0-9]{2,10}$/.test(normalized)) return { ok: false };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from("research_history").insert({ user_id: user.id, symbol: normalized });
  if (!error) {
    const admin = createAdminClient();
    if (admin) await admin.rpc("touch_hot_symbol", { p_symbol: normalized, p_reason: "view", p_hot_minutes: 60 });
  }
  return { ok: !error };
}
