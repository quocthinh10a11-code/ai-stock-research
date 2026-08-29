"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeStockSymbol } from "@/lib/market-universe";
import { createAdminClient } from "@/lib/supabase/admin";

export interface WatchlistActionResult {
  ok: boolean;
  saved: boolean;
  message: string;
}

export async function setWatchlistStatus(symbol: string, shouldSave: boolean): Promise<WatchlistActionResult> {
  const normalized = normalizeStockSymbol(symbol);
  if (!/^[A-Z0-9]{2,10}$/.test(normalized)) return { ok: false, saved: false, message: "Mã cổ phiếu không hợp lệ." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, saved: false, message: "Đăng nhập lại để cập nhật danh sách theo dõi." };

  const query = shouldSave
    ? supabase.from("user_watchlist").upsert({ user_id: user.id, symbol: normalized }, { onConflict: "user_id,symbol" })
    : supabase.from("user_watchlist").delete().eq("user_id", user.id).eq("symbol", normalized);
  const { error } = await query;
  if (error) return { ok: false, saved: !shouldSave, message: "Không thể cập nhật danh sách theo dõi. Hãy kiểm tra migration Supabase mới nhất." };
  if (shouldSave) {
    const admin = createAdminClient();
    if (admin) await admin.rpc("touch_hot_symbol", { p_symbol: normalized, p_reason: "watchlist", p_hot_minutes: 1440 });
  }

  revalidatePath("/discover");
  revalidatePath(`/analysis/${normalized}`);
  return { ok: true, saved: shouldSave, message: shouldSave ? `Đã thêm ${normalized} vào danh sách theo dõi.` : `Đã xóa ${normalized} khỏi danh sách theo dõi.` };
}
