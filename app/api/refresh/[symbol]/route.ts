import { NextResponse } from "next/server";
import { normalizeStockSymbol } from "@/lib/market-universe";
import { normalizeRefreshDataTypes } from "@/lib/refresh-contract";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ symbol: string }> }) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const symbol = normalizeStockSymbol((await context.params).symbol);
  if (!/^[A-Z0-9]{2,10}$/.test(symbol)) return NextResponse.json({ error: "Mã cổ phiếu không hợp lệ." }, { status: 400 });

  let body: { dataTypes?: unknown } = {};
  try { body = await request.json() as { dataTypes?: unknown }; }
  catch { /* Empty request bodies use the default structured data types. */ }

  let dataTypes;
  try { dataTypes = normalizeRefreshDataTypes(body.dataTypes); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid data types." }, { status: 400 }); }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Refresh orchestration is not configured." }, { status: 503 });
  const { data, error } = await admin.rpc("enqueue_refresh_jobs", {
    p_symbol: symbol,
    p_data_types: dataTypes,
    p_requested_by: user.id,
  });
  if (error) {
    if (error.code === "23503") return NextResponse.json({ error: "Không tìm thấy mã cổ phiếu." }, { status: 404 });
    console.error("Refresh enqueue failed", { symbol, code: error.code, message: error.message });
    return NextResponse.json({ error: "Không thể xếp lịch làm mới lúc này." }, { status: 503 });
  }
  return NextResponse.json({ accepted: true, symbol, jobs: data ?? [] }, { status: 202 });
}
