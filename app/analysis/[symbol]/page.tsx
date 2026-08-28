import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { CompanyFinancialDashboard } from "@/components/features/CompanyFinancialDashboard";
import { RealtimeResearch } from "@/components/features/RealtimeResearch";
import { ResearchHistoryTracker } from "@/components/features/ResearchHistoryTracker";
import { WatchlistButton } from "@/components/features/WatchlistButton";
import { TopNavBar } from "@/components/ui/TopNavBar";
import { getAnalysis } from "@/lib/data/get-analysis";
import { getUserWatchlist } from "@/lib/data/get-user-research";

export default async function AnalysisPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const [item, watchlist] = await Promise.all([getAnalysis(symbol), getUserWatchlist()]);
  if (!item) notFound();

  return <><TopNavBar/><ResearchHistoryTracker symbol={item.symbol}/><main className="min-h-screen bg-canvas pb-20 pt-18"><div className="mx-auto max-w-7xl px-5 py-8">
    <Link href="/home" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-navy"><ArrowLeft size={15}/>Trang chủ</Link>
    <header className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-7"><div className="flex flex-wrap items-end justify-between gap-6"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-base font-bold text-navy">{item.symbol}</span><span className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-600">{item.exchange}</span><span className="text-xs text-slate-500">{item.sector}</span></div><h1 className="mt-3 text-3xl font-bold tracking-tight text-navy md:text-4xl">{item.company}</h1><p className="mt-2 text-xs text-slate-500">Dữ liệu thị trường: {item.updatedAt ? new Date(item.updatedAt).toLocaleString("vi-VN") : "chưa đồng bộ"}</p></div><div className="flex items-end gap-5"><WatchlistButton symbol={item.symbol} initiallySaved={watchlist.includes(item.symbol)}/><div className="text-right">{item.price == null ? <><p className="text-sm font-bold text-warning">Chưa có giá đồng bộ</p><p className="mt-1 text-xs text-slate-500">AI vẫn dùng nguồn web có dẫn chứng</p></> : <><p className="font-mono text-3xl font-bold text-navy">{item.price.toLocaleString("vi-VN")} ₫</p><p className={`mt-1 font-mono text-sm font-bold ${(item.change ?? 0) >= 0 ? "text-bull" : "text-bear"}`}>{(item.change ?? 0) >= 0 ? "+" : ""}{item.change ?? 0}%</p></>}</div></div></div></header>
    <div className="mt-5"><RealtimeResearch symbol={item.symbol}/></div>
    <div className="mt-5"><CompanyFinancialDashboard periods={item.financials}/></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]"><section className="panel p-5 md:p-6"><h2 className="text-lg font-bold text-navy">Tín hiệu kỹ thuật đã đồng bộ</h2><p className="mt-2 max-w-[72ch] text-sm leading-6 text-slate-600">{item.summary}</p>{item.evidence.length > 0 ? <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{item.evidence.map((e) => <div key={e.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-600">{e.label}</p><p className="mt-2 font-mono text-lg font-bold text-navy">{e.value}</p><p className="mt-1 text-xs text-slate-500">{e.detail}</p></div>)}</div> : <p className="mt-4 text-sm text-slate-500">Chưa có chỉ báo kỹ thuật cho mã này. Phân tích AI phía trên vẫn sử dụng nguồn internet realtime.</p>}</section><aside className="panel overflow-hidden"><div className="panel-header"><h2 className="font-bold text-navy">Doanh nghiệp cùng ngành</h2></div><div className="divide-y divide-slate-200">{item.related.map((stock) => <Link key={stock.symbol} href={`/analysis/${stock.symbol}`} className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50"><div><p className="font-mono text-sm font-bold text-blue-800">{stock.symbol}<span className="ml-2 font-sans text-[10px] text-slate-500">{stock.exchange}</span></p><p className="mt-1 line-clamp-1 text-xs text-slate-500">{stock.company}</p></div><div className="text-right"><p className="font-mono text-xs">{stock.price == null ? "—" : stock.price.toLocaleString("vi-VN")}</p><p className={`font-mono text-[10px] ${(stock.change ?? 0) >= 0 ? "text-bull" : "text-bear"}`}>{stock.change == null ? "chưa đồng bộ" : `${stock.change >= 0 ? "+" : ""}${stock.change}%`}</p></div></Link>)}{item.related.length === 0 && <p className="p-5 text-sm text-slate-500">Chưa có doanh nghiệp cùng ngành trong catalog.</p>}</div></aside></div>
  </div></main></>;
}
