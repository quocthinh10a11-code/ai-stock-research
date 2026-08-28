import { AlertCircle, CheckCircle2, MinusCircle, TrendingDown, TrendingUp } from "lucide-react";
import type { InvestmentAction, InvestmentDecisionRow, ResearchCitation } from "@/types/stock";
import { cn } from "@/lib/utils";

const actionLabels: Record<InvestmentAction, string> = { buy: "Mua", accumulate: "Tích lũy", hold: "Nắm giữ", reduce: "Hạ tỷ trọng", sell: "Bán", insufficient_data: "Chưa đủ dữ liệu" };

function actionStyle(action: InvestmentAction) {
  if (action === "buy" || action === "accumulate") return { className: "bg-green-50 text-bull", Icon: TrendingUp };
  if (action === "reduce" || action === "sell") return { className: "bg-red-50 text-bear", Icon: TrendingDown };
  if (action === "hold") return { className: "bg-amber-50 text-warning", Icon: MinusCircle };
  return { className: "bg-slate-100 text-slate-600", Icon: AlertCircle };
}

export function InvestmentDecisionTable({ rows, citations }: { rows: InvestmentDecisionRow[]; citations: ResearchCitation[] }) {
  return <section aria-labelledby="decision-matrix-title">
    <div className="border-b border-slate-200 px-5 py-5 md:px-6"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-navy" size={20}/><div><h2 id="decision-matrix-title" className="text-lg font-bold text-navy">Từ chỉ số đến quyết định đầu tư</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">AI đối chiếu chuỗi dữ liệu và nguồn web hiện tại. Tín hiệu chỉ có giá trị khi số liệu đủ và có thể kiểm chứng.</p></div></div></div>
    <div className="hidden grid-cols-[1.05fr_1.1fr_1.65fr_1.1fr] border-b bg-slate-50 px-6 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 lg:grid"><span>Nhóm chỉ số</span><span>Chỉ số hiện có</span><span>AI đọc & xử lý</span><span>Tín hiệu</span></div>
    <div className="divide-y divide-slate-200">{rows.map((row) => { const { className, Icon } = actionStyle(row.action); return <article key={row.group} className="grid gap-5 px-5 py-5 md:px-6 lg:grid-cols-[1.05fr_1.1fr_1.65fr_1.1fr] lg:gap-6">
      <div><p className="text-sm font-bold text-navy">{row.title}</p><p className="mt-1 text-xs text-slate-500">Độ tin cậy: {row.confidence === "high" ? "cao" : row.confidence === "medium" ? "trung bình" : "thấp"}</p></div>
      <div className="flex flex-wrap gap-2 lg:block lg:space-y-2">{row.metrics.map((metric) => <div key={metric.name} className="min-w-28 rounded-md border border-slate-200 bg-slate-50 px-3 py-2"><div className="flex items-baseline justify-between gap-3"><span className="text-xs font-semibold text-slate-600">{metric.name}</span><span className={cn("font-mono text-xs font-bold", metric.value == null && "text-slate-400")}>{metric.value ?? "Chưa có"}</span></div>{metric.trend && <p className="mt-1 text-xs leading-5 text-slate-500">{metric.trend}</p>}{metric.sourceIndices.length > 0 && <div className="mt-1 flex gap-1">{metric.sourceIndices.map((index) => citations[index - 1] && <a key={index} href={citations[index - 1].url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-800 underline underline-offset-2" aria-label={`Mở nguồn ${index}`}>[{index}]</a>)}</div>}</div>)}</div>
      <p className="text-sm leading-6 text-slate-700">{row.analysis}</p>
      <div><span className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold uppercase", className)}><Icon size={14}/>{actionLabels[row.action]}</span><p className="mt-2 text-xs leading-5 text-slate-600">{row.rationale}</p></div>
    </article>; })}</div>
  </section>;
}
