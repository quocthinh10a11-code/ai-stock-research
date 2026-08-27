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
    if (!symbol.trim()) {
      setError("Enter a stock ticker to continue.");
      return;
    }
    setSearching(true);
    const result = await resolveStockSymbol(symbol);
    setSearching(false);
    if (!result.found) { setError(result.error); return; }
    setError("");
    router.push(`/analysis/${encodeURIComponent(result.symbol)}`);
  }

  return <div className="mx-auto mt-10 max-w-2xl"><form onSubmit={submit} className="flex border border-white/20 bg-white p-1.5 text-navy" noValidate><Search className="ml-3 self-center text-slate-400" size={20}/><input value={symbol} onChange={(event) => { setSymbol(event.target.value); if (error) setError(""); }} className="min-w-0 flex-1 px-3 py-3 font-mono text-sm outline-none" placeholder="Search HOSE, HNX or UPCOM, e.g. FPT, ACB, VGI" aria-label="Stock symbol" aria-invalid={Boolean(error)} aria-describedby={error ? "hero-search-error" : undefined}/><button className="btn-primary shrink-0" type="submit" disabled={searching}>{searching ? "Searching…" : "Analyze"} <ArrowRight size={16}/></button></form>{error && <p id="hero-search-error" role="alert" className="mt-3 text-left text-sm font-medium text-red-300">{error}</p>}</div>;
}
