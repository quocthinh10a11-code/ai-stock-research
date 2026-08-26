"use client";
import { useState } from "react";
import Link from "next/link";
import { Bell, Search, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupportedStockSymbol, marketUniverse, normalizeStockSymbol } from "@/lib/market-universe";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

export function TopNavBar({ variant = "app" }: { variant?: "public" | "home" | "app" }) {
  const router = useRouter();
  const pathname = usePathname();
  const [symbol, setSymbol] = useState("");
  const [searchError, setSearchError] = useState("");
  async function signOut() { const supabase = createClient(); await supabase.auth.signOut(); router.replace("/"); router.refresh(); }
  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const clean = normalizeStockSymbol(symbol);
    if (!clean) { setSearchError("Enter a ticker."); return; }
    if (!isSupportedStockSymbol(clean)) { setSearchError(`${clean} is unavailable. Try ${marketUniverse.slice(0, 3).join(", ")}.`); return; }
    setSearchError("");
    router.push(`/analysis/${encodeURIComponent(clean)}`);
  }
  if (variant === "public") return <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-navy/95 text-white backdrop-blur"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5"><Logo inverse /><nav className="hidden items-center gap-8 font-display text-sm text-slate-300 md:flex"><a href="#market">Market</a><a href="#features">Research</a><a href="#about">About</a></nav><div className="flex items-center gap-3"><Link href="/login" className="text-sm font-semibold">Log in</Link><Link href="/login" className="rounded bg-white px-4 py-2 text-sm font-semibold text-navy">Start researching</Link></div></div></header>;
  if (variant === "home") return <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-navy/95 text-white backdrop-blur"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5"><Logo inverse /><nav className="hidden items-center gap-8 font-display text-sm text-slate-300 md:flex"><a href="#market">Market</a><a href="#features">Research</a><a href="#about">About</a></nav><div className="flex items-center gap-3"><button onClick={signOut} className="text-sm font-semibold text-slate-300 hover:text-white">Sign out</button><Link href="/discover" className="rounded bg-white px-4 py-2 text-sm font-semibold text-navy">Open Discover</Link></div></div></header>;
  const appLinks = [{ href: "/discover", label: "Discover" }, { href: "/technical", label: "Technical" }, { href: "/sentiment", label: "Sentiment" }, { href: "/portfolio", label: "Portfolio" }];
  return <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-slate-200 bg-white"><div className="flex h-full items-center"><div className="w-60 shrink-0 border-r border-slate-200 px-5"><Logo /></div><div className="flex flex-1 items-center justify-between gap-4 px-5"><form onSubmit={submitSearch} className="relative hidden w-full max-w-xl md:block" noValidate><label className="relative block"><span className="sr-only">Search stock ticker</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input value={symbol} onChange={(event) => { setSymbol(event.target.value); if (searchError) setSearchError(""); }} className="h-10 w-full rounded border border-slate-200 bg-slate-50 pl-9 pr-16 text-sm outline-none focus:border-slate-500" placeholder="Search ticker or company" aria-invalid={Boolean(searchError)} aria-describedby={searchError ? "top-search-error" : undefined}/><kbd className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-slate-400">Enter</kbd></label>{searchError && <p id="top-search-error" role="alert" className="absolute left-0 top-11 border border-red-200 bg-white px-3 py-2 text-xs font-medium text-bear shadow-lg">{searchError}</p>}</form><nav className="hidden shrink-0 items-center gap-1 2xl:flex" aria-label="Primary navigation">{appLinks.map((item) => { const active = pathname.startsWith(item.href); return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("rounded px-3 py-2 text-xs font-semibold transition-colors", active ? "bg-navy text-white" : "text-slate-500 hover:bg-slate-100 hover:text-navy")}>{item.label}</Link>; })}</nav><div className="ml-auto flex items-center gap-2"><button aria-label="Notifications" className="grid size-9 place-items-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50"><Bell size={17}/></button><button aria-label="Account" className="grid size-9 place-items-center rounded bg-navy text-white"><UserRound size={17}/></button></div></div></div></header>;
}
