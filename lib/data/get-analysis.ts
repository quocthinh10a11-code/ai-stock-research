import { normalizeStockSymbol } from "@/lib/market-universe";
import { createPublicDataClient } from "@/lib/supabase/public-data";
import type { EvidenceItem, StockAnalysis } from "@/types/stock";

const signalLabels: Record<string, string> = {
  sma20: "SMA 20",
  sma50: "SMA 50",
  ema20: "EMA 20",
  ema50: "EMA 50",
  rsi14: "RSI 14",
  atr14: "ATR 14",
  volume_ma20: "Volume MA 20",
  relative_volume: "Relative volume",
};

function formatSignal(name: string, value: number) {
  if (name === "rsi14") return value.toFixed(1);
  if (name === "relative_volume") return `${value.toFixed(2)}×`;
  if (name === "volume_ma20") return Math.round(value).toLocaleString("vi-VN");
  return `${Math.round(value).toLocaleString("vi-VN")} ₫`;
}

export async function getAnalysis(symbol = "FPT"): Promise<StockAnalysis | null> {
  const normalized = normalizeStockSymbol(symbol);
  if (!/^[A-Z0-9]{2,10}$/.test(normalized)) return null;
  const supabase = createPublicDataClient();
  if (!supabase) return null;

  const { data: snapshot, error: snapshotError } = await supabase.from("latest_market_snapshots").select("symbol,company_name,close,previous_close,bias").eq("symbol", normalized).maybeSingle();
  if (snapshotError || !snapshot || snapshot.close == null) return null;

  const { data: synthesis } = await supabase.from("agent_analysis").select("summary_text").eq("symbol", normalized).order("analysis_date", { ascending: false }).limit(1).maybeSingle();
  const { data: signals } = await supabase.from("evidence_snapshots").select("signal_name,signal_value,signal_direction,source,date").eq("symbol", normalized).order("date", { ascending: false }).limit(8);
  const price = Number(snapshot.close);
  const previous = Number(snapshot.previous_close ?? snapshot.close);
  const change = previous ? Number((((price - previous) / previous) * 100).toFixed(2)) : 0;
  const score = snapshot.bias === "bullish" ? 85 : snapshot.bias === "bearish" ? 30 : 55;
  const evidence: EvidenceItem[] = (signals ?? []).map((signal) => ({
    label: signalLabels[signal.signal_name] ?? signal.signal_name,
    value: formatSignal(signal.signal_name, Number(signal.signal_value)),
    detail: `${signal.source} · ${signal.date}`,
    tone: signal.signal_direction === "supporting" ? "positive" : "negative",
  }));

  return {
    symbol: snapshot.symbol,
    company: snapshot.company_name,
    price,
    change,
    score,
    summary: synthesis?.summary_text ?? "Rule-based analysis has not been generated for this symbol yet.",
    evidence,
  };
}
