"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeStockSymbol } from "@/lib/mock-symbols";

export interface WatchlistActionResult {
  ok: boolean;
  saved: boolean;
  message: string;
}

export async function setWatchlistStatus(symbol: string, shouldSave: boolean): Promise<WatchlistActionResult> {
  const normalized = normalizeStockSymbol(symbol);
  if (!/^[A-Z0-9]{2,10}$/.test(normalized)) return { ok: false, saved: false, message: "Invalid stock ticker." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, saved: false, message: "Sign in again to update your watchlist." };

  const query = shouldSave
    ? supabase.from("user_watchlist").upsert({ user_id: user.id, symbol: normalized }, { onConflict: "user_id,symbol" })
    : supabase.from("user_watchlist").delete().eq("user_id", user.id).eq("symbol", normalized);
  const { error } = await query;
  if (error) return { ok: false, saved: !shouldSave, message: "Could not update watchlist. Apply the latest Supabase migration and try again." };

  revalidatePath("/discover");
  revalidatePath("/portfolio");
  return { ok: true, saved: shouldSave, message: shouldSave ? `${normalized} saved to watchlist.` : `${normalized} removed from watchlist.` };
}
