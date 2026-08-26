"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { isSupportedStockSymbol, marketUniverse, normalizeStockSymbol } from "@/lib/market-universe";

export function HeroSearch() {
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = normalizeStockSymbol(symbol);
    if (!clean) {
      setError("Enter a stock ticker to continue.");
      return;
    }
    if (!isSupportedStockSymbol(clean)) {
      setError(`Ticker ${clean} is not available yet. Try ${marketUniverse.slice(0, 5).join(", ")}.`);
      return;
    }
    setError("");
    router.push(`/analysis/${encodeURIComponent(clean)}`);
  }

  return <div className="mx-auto mt-10 max-w-2xl"><form onSubmit={submit} className="flex border border-white/20 bg-white p-1.5 text-navy" noValidate><Search className="ml-3 self-center text-slate-400" size={20}/><input value={symbol} onChange={(event) => { setSymbol(event.target.value); if (error) setError(""); }} className="min-w-0 flex-1 px-3 py-3 font-mono text-sm outline-none" placeholder="Enter a ticker, e.g. FPT, VCB, HPG" aria-label="Stock symbol" aria-invalid={Boolean(error)} aria-describedby={error ? "hero-search-error" : undefined}/><button className="btn-primary shrink-0" type="submit">Analyze <ArrowRight size={16}/></button></form>{error && <p id="hero-search-error" role="alert" className="mt-3 text-left text-sm font-medium text-red-300">{error}</p>}</div>;
}
