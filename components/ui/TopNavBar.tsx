"use client";

import { useState } from "react";
import Link from "next/link";
import { Compass, House, LogOut, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveStockSymbol } from "@/lib/stock-search";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

const links = [{ href: "/home", label: "Trang chủ", Icon: House }, { href: "/discover", label: "Khám phá", Icon: Compass }];

export function TopNavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!symbol.trim()) { setError("Nhập mã cổ phiếu."); return; }
    setSearching(true);
    const result = await resolveStockSymbol(symbol);
    setSearching(false);
    if (!result.found) { setError(result.error); return; }
    setError("");
    setSymbol("");
    router.push(`/analysis/${encodeURIComponent(result.symbol)}`);
  }

  return <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white">
    <div className="mx-auto flex h-18 max-w-[1440px] items-center gap-3 px-3 sm:px-5">
      <Logo/>
      <form onSubmit={submit} className="relative mx-auto min-w-0 max-w-xl flex-1" noValidate>
        <label className="relative block"><span className="sr-only">Tìm mã cổ phiếu hoặc tên công ty</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/><input value={symbol} onChange={(event) => { setSymbol(event.target.value.toUpperCase()); setError(""); }} className="h-10 w-full rounded-lg border border-slate-300 bg-slate-50 pl-9 pr-3 font-mono text-sm text-navy outline-none placeholder:font-sans focus:border-navy focus:bg-white" placeholder="FPT, MBS, VGI..." aria-invalid={Boolean(error)} aria-describedby={error ? "nav-search-error" : undefined}/></label>
        {error && <p id="nav-search-error" role="alert" className="absolute left-0 top-11 z-50 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-bear shadow-sm">{error}</p>}
        <button type="submit" className="sr-only">{searching ? "Đang tìm" : "Phân tích"}</button>
      </form>
      <nav className="flex items-center gap-1" aria-label="Điều hướng chính">{links.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold", active ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-100 hover:text-navy")}><Icon size={16}/><span className="hidden xl:inline">{label}</span></Link>;
      })}<button onClick={signOut} className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-navy" aria-label="Đăng xuất"><LogOut size={17}/></button></nav>
    </div>
  </header>;
}
