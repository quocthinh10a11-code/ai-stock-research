import { NextResponse } from "next/server";
import { normalizeStockSymbol } from "@/lib/market-universe";
import { staleStructuredDataTypes } from "@/lib/refresh-contract";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicDataClient } from "@/lib/supabase/public-data";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const query = normalizeStockSymbol(new URL(request.url).searchParams.get("q") ?? "");
  if (!/^[A-Z0-9]{2,10}$/.test(query)) return NextResponse.json({ found: false }, { status: 400 });
  const supabase = createPublicDataClient();
  if (!supabase) return NextResponse.json({ error: "Market search is not configured." }, { status: 503 });
  const { data, error } = await supabase.from("stocks").select("symbol,company_name,sector,exchange").eq("symbol", query).maybeSingle();
  if (error) return NextResponse.json({ error: "Market search is temporarily unavailable." }, { status: 503 });
  if (!data) return NextResponse.json({ found: false });

  const [{ data: market }, { data: fundamentals }, auth] = await Promise.all([
    supabase.from("current_market_snapshots").select("price_expires_at").eq("symbol", query).maybeSingle(),
    supabase.from("financial_periods").select("expires_at").eq("symbol", query).eq("period_type", "quarter").order("period_end", { ascending: false }).limit(1).maybeSingle(),
    createClient(),
  ]);
  const dataTypes = staleStructuredDataTypes({
    marketExpiresAt: market?.price_expires_at,
    fundamentalsExpiresAt: fundamentals?.expires_at,
  });
  let refresh = { requested: false, dataTypes };
  if (dataTypes.length > 0) {
    const { data: { user } } = await auth.auth.getUser();
    const admin = user ? createAdminClient() : null;
    if (user && admin) {
      const { error: refreshError } = await admin.rpc("enqueue_refresh_jobs", {
        p_symbol: query,
        p_data_types: dataTypes,
        p_requested_by: user.id,
      });
      if (refreshError) console.error("Search refresh enqueue failed", { symbol: query, code: refreshError.code, message: refreshError.message });
      else refresh = { requested: true, dataTypes };
    }
  }
  return NextResponse.json({ found: true, stock: data, refresh });
}
