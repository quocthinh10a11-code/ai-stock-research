import { NextResponse } from "next/server";
import { normalizeStockSymbol } from "@/lib/market-universe";
import { createPublicDataClient } from "@/lib/supabase/public-data";

export async function GET(request: Request) {
  const query = normalizeStockSymbol(new URL(request.url).searchParams.get("q") ?? "");
  if (!/^[A-Z0-9]{2,10}$/.test(query)) return NextResponse.json({ found: false }, { status: 400 });
  const supabase = createPublicDataClient();
  if (!supabase) return NextResponse.json({ error: "Market search is not configured." }, { status: 503 });
  const { data, error } = await supabase.from("stocks").select("symbol,company_name,sector,exchange").eq("symbol", query).maybeSingle();
  if (error) return NextResponse.json({ error: "Market search is temporarily unavailable." }, { status: 503 });
  return NextResponse.json(data ? { found: true, stock: data } : { found: false });
}
