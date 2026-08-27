import { normalizeStockSymbol } from "@/lib/market-universe";

export async function resolveStockSymbol(value: string) {
  const symbol = normalizeStockSymbol(value);
  if (!/^[A-Z0-9]{2,10}$/.test(symbol)) return { symbol, found: false, error: "Mã cổ phiếu chỉ gồm 2–10 chữ cái hoặc chữ số." };
  try {
    const response = await fetch(`/api/stocks/resolve?q=${encodeURIComponent(symbol)}`);
    const body = await response.json() as { found?: boolean; error?: string };
    if (!response.ok && body.error) return { symbol, found: false, error: body.error };
    return { symbol, found: Boolean(body.found), error: body.found ? "" : `Không tìm thấy ${symbol} trên HOSE, HNX hoặc UPCOM.` };
  } catch {
    return { symbol, found: false, error: "Không thể kết nối dữ liệu thị trường. Vui lòng thử lại." };
  }
}
