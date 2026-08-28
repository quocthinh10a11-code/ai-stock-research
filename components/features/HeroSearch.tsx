"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { resolveStockSymbol } from "@/lib/stock-search";

export function HeroSearch() {
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!symbol.trim()) { setError("Nhập mã cổ phiếu để bắt đầu."); return; }
    setSearching(true);
    const result = await resolveStockSymbol(symbol);
    setSearching(false);
    if (!result.found) { setError(result.error); return; }
    setError("");
    router.push(`/analysis/${encodeURIComponent(result.symbol)}`);
  }

  return <div className="mt-8 w-full max-w-3xl"><form onSubmit={submit} className="flex flex-col gap-2 rounded-xl border border-slate-300 bg-white p-2 shadow-sm sm:flex-row" noValidate><label className="relative min-w-0 flex-1"><span className="sr-only">Mã cổ phiếu</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20}/><input value={symbol} onChange={(event) => { setSymbol(event.target.value.toUpperCase()); setError(""); }} className="h-12 w-full rounded-lg bg-slate-50 pl-10 pr-3 font-mono text-base font-semibold text-navy outline-none focus:bg-white" placeholder="Nhập FPT, MBS, VGI…" aria-invalid={Boolean(error)} aria-describedby={error ? "hero-search-error" : undefined}/></label><button className="btn-primary h-12 shrink-0 px-5" type="submit" disabled={searching}>{searching ? "Đang tìm…" : "Phân tích cổ phiếu"}<ArrowRight size={16}/></button></form>{error && <p id="hero-search-error" role="alert" className="mt-3 text-sm font-medium text-bear">{error}</p>}</div>;
}
