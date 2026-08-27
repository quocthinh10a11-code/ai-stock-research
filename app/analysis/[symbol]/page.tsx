import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { CompanyFinancialDashboard } from "@/components/features/CompanyFinancialDashboard";
import { RealtimeResearch } from "@/components/features/RealtimeResearch";
import { ResearchHistoryTracker } from "@/components/features/ResearchHistoryTracker";
import { TopNavBar } from "@/components/ui/TopNavBar";
import { getAnalysis } from "@/lib/data/get-analysis";

export default async function AnalysisPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const item = await getAnalysis(symbol);
  if (!item) notFound();
  return <>
    <TopNavBar variant="app" />
    <ResearchHistoryTracker symbol={item.symbol} />
    <main className="min-h-screen bg-canvas px-5 pb-20 pt-28">
      <div className="mx-auto max-w-7xl">
        <Link href="/home" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-navy"><ArrowLeft size={15}/>Back to market</Link>
        <section className="mt-7 border-y border-slate-200 bg-white px-6 py-7 md:px-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="flex items-center gap-3"><span className="font-mono text-sm font-semibold">{item.symbol}</span><span className="rounded border px-2 py-1 text-[10px] font-semibold text-slate-500">{item.exchange}</span><span className="text-xs text-slate-500">{item.sector}</span></div>
              <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">{item.company}</h1>
              <p className="mt-2 text-xs text-slate-500">Market data updated {item.updatedAt ? new Date(item.updatedAt).toLocaleString("vi-VN") : "not yet synchronized"}</p>
            </div>
            <div className="text-right">
              {item.price == null ? <p className="text-sm font-semibold text-warning">Price pending sync</p> : <><p className="font-mono text-3xl font-semibold">{item.price.toLocaleString("vi-VN")} ₫</p><p className={`mt-1 font-mono text-sm ${(item.change ?? 0) >= 0 ? "text-bull" : "text-bear"}`}>{(item.change ?? 0) >= 0 ? "+" : ""}{item.change ?? 0}%</p></>}
            </div>
          </div>
        </section>
        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]">
          <section className="panel p-6">
            <h2 className="font-display text-title font-semibold">Technical evidence</h2>
            <p className="mt-3 max-w-[72ch] text-sm leading-7 text-slate-700">{item.summary}</p>
            <div className="mt-6 grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">{item.evidence.map((e) => <div key={e.label} className="bg-slate-50 p-4"><p className="label">{e.label}</p><p className="mt-3 font-mono text-lg font-semibold">{e.value}</p><p className="mt-1 text-xs text-slate-500">{e.detail}</p></div>)}</div>
            {item.evidence.length === 0 && <p className="mt-5 text-sm text-slate-500">Technical indicators are pending market-data synchronization.</p>}
          </section>
          <aside className="panel">
            <div className="panel-header"><h2 className="font-display font-semibold">Related companies</h2></div>
            <div className="divide-y">{item.related.map((stock) => <Link key={stock.symbol} href={`/analysis/${stock.symbol}`} className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50"><div><p className="font-mono text-sm font-semibold">{stock.symbol} <span className="font-sans text-[10px] text-slate-400">{stock.exchange}</span></p><p className="mt-1 line-clamp-1 text-xs text-slate-500">{stock.company}</p></div><div className="text-right"><p className="font-mono text-xs">{stock.price == null ? "—" : stock.price.toLocaleString("vi-VN")}</p><p className={`font-mono text-[10px] ${(stock.change ?? 0) >= 0 ? "text-bull" : "text-bear"}`}>{stock.change == null ? "pending" : `${stock.change >= 0 ? "+" : ""}${stock.change}%`}</p></div></Link>)}{item.related.length === 0 && <p className="p-5 text-sm text-slate-500">No sector peers synchronized.</p>}</div>
          </aside>
        </div>
        <div className="mt-5"><CompanyFinancialDashboard periods={item.financials}/></div>
        <div className="mt-5"><RealtimeResearch symbol={item.symbol}/></div>
      </div>
    </main>
  </>;
}
