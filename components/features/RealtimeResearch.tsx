"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, RefreshCw, Sparkles } from "lucide-react";
import type { GroundedResearch } from "@/types/stock";
import { InvestmentDecisionTable } from "./InvestmentDecisionTable";
import { FreshnessBadge } from "@/components/ui/FreshnessBadge";
import { buildFreshness } from "@/lib/freshness";

export function RealtimeResearch({ symbol }: { symbol: string }) {
  const [report, setReport] = useState<GroundedResearch | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState(0);

  async function refresh(force = false) {
    setLoading(true);
    setPhase(0);
    setError("");
    try {
      for (let attempt = 0; attempt < 36; attempt += 1) {
        const response = await fetch(`/api/research/${encodeURIComponent(symbol)}${force ? "?refresh=1" : ""}`, { method: "POST" });
        const raw = await response.text();
        let body: (GroundedResearch & { error?: string }) | { pending: true; retryAfterMs?: number; error?: string };
        try { body = JSON.parse(raw); }
        catch { throw new Error("Dịch vụ nghiên cứu trả về dữ liệu không hợp lệ. Vui lòng thử lại."); }
        if (response.status === 202 && "pending" in body) {
          const delay = Math.max(1_000, Math.min(Number(body.retryAfterMs ?? 2_500), 5_000));
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        if (!response.ok) throw new Error(body.error ?? "Không thể hoàn tất nghiên cứu realtime.");
        setReport(body as GroundedResearch);
        return;
      }
      throw new Error("Nghiên cứu đang được xử lý lâu hơn dự kiến. Hãy thử lại sau ít phút.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể hoàn tất nghiên cứu realtime.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void refresh(false); }, [symbol]);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setPhase((current) => Math.min(current + 1, 3)), 4_500);
    return () => window.clearInterval(timer);
  }, [loading]);

  if (loading) {
    const phases = ["Tìm nguồn tài chính mới trên Internet", "Đọc nội dung trang và báo cáo PDF", "Trích xuất số liệu kèm kỳ, đơn vị và bằng chứng", "Đối chiếu dữ kiện và tổng hợp phân tích"];
    return <section className="panel p-6" aria-busy="true"><div className="flex items-center gap-3"><Sparkles size={19}/><h2 className="text-lg font-bold">Live Internet Financial Research Agent</h2></div><p className="mt-2 text-sm text-slate-600">Agent đang thực hiện pipeline có kiểm chứng. Lần đầu có thể mất khoảng một phút; các lần sau dùng cache theo nội dung nguồn.</p><ol className="mt-5 grid gap-2 sm:grid-cols-2">{phases.map((label, index) => <li key={label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${index <= phase ? "border-blue-200 bg-blue-50 text-navy" : "border-slate-200 text-slate-400"}`}>{index < phase ? <CheckCircle2 size={15}/> : <span className="grid size-[15px] place-items-center rounded-full border text-[9px]">{index + 1}</span>}{label}</li>)}</ol><div className="mt-6 space-y-3">{["w-11/12", "w-full", "w-4/5"].map((width) => <div key={width} className={`h-3 animate-pulse rounded bg-slate-100 ${width}`}/>)}</div></section>;
  }

  if (error) return <section className="panel p-6"><div className="flex gap-3 text-warning"><AlertTriangle size={20}/><div><h2 className="font-bold text-navy">Chưa thể tạo phân tích AI</h2><p className="mt-1 text-sm text-slate-600">{error}</p><button onClick={() => void refresh(true)} className="btn-secondary mt-4"><RefreshCw size={15}/>Thử lại</button></div></div></section>;
  if (!report) return null;
  const facts = report.facts ?? report.citations.flatMap((citation) => citation.facts ?? []);
  const warnings = report.warnings ?? [];
  const freshness = buildFreshness({ kind: "ai", providerTimestamp: report.asOf, fetchedAt: report.asOf, expiresAt: report.expiresAt, sourceName: report.model.includes("tavily") ? "Tavily + Gemini" : "Gemini Google Search", sourceUrl: null, dataQuality: "verified-sources", lastError: null, refreshStatus: "ready" });

  return <section className="panel overflow-hidden">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 md:px-6"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-navy text-white"><Sparkles size={17}/></span><div><h2 className="font-bold text-navy">Phân tích AI có dẫn nguồn</h2><p className="mt-0.5 text-xs text-slate-500">{report.cached ? "Cache theo nội dung nguồn" : "Vừa đọc Internet và tổng hợp"} · {report.model}</p></div></div><FreshnessBadge freshness={freshness}/><button onClick={() => void refresh(true)} className="btn-secondary"><RefreshCw size={15}/>Nghiên cứu lại</button></header>
    <InvestmentDecisionTable rows={report.decisionMatrix} citations={report.citations}/>
    <div className="border-t border-slate-200 px-5 py-5 md:px-6"><div className="flex items-center gap-2"><FileText size={17} className="text-blue-800"/><h2 className="text-sm font-bold text-navy">Dữ kiện tài chính agent đọc được</h2></div>{facts.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{facts.slice(0, 18).map((fact, index) => <div key={`${fact.metric}-${fact.period}-${fact.sourceIndex}-${index}`} className="rounded-lg border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold text-slate-600">{fact.label}</p><a href={report.citations[fact.sourceIndex - 1]?.url} target="_blank" rel="noreferrer" className="font-mono text-[10px] font-bold text-blue-800">[{fact.sourceIndex}]</a></div><p className="mt-1 font-mono text-sm font-bold text-navy">{fact.value}{fact.unit ? ` ${fact.unit}` : ""}</p><p className="mt-1 text-[11px] text-slate-500">{fact.period ?? "Chưa xác định kỳ"}{fact.page ? ` · Trang ${fact.page}` : ""} · {fact.confidence === "high" ? "Tin cậy cao" : "Cần đối chiếu"}</p><p className="mt-2 line-clamp-3 text-[11px] leading-5 text-slate-600">{fact.evidence}</p></div>)}</div> : <p className="mt-3 text-sm text-slate-600">Agent chưa tìm được số liệu đủ bằng chứng trong các nguồn công khai vừa đọc. Các metric thiếu vẫn giữ “Chưa có/Chưa xác minh”.</p>}{warnings.map((warning) => <p key={warning} className="mt-3 text-xs text-warning">{warning}</p>)}</div>
    <div className="grid border-t border-slate-200 lg:grid-cols-[1.3fr_.7fr]">
      <div className="p-5 md:p-6 lg:border-r"><h2 className="text-lg font-bold text-navy">Kết luận có kiểm chứng</h2><p className="mt-3 max-w-[72ch] text-sm leading-7 text-slate-700">{report.summary}</p><h3 className="mt-6 text-sm font-bold text-navy">Triển vọng</h3><p className="mt-2 max-w-[72ch] text-sm leading-7 text-slate-700">{report.outlook}</p><div className="mt-6 grid gap-6 sm:grid-cols-2"><div><h3 className="text-sm font-bold text-bull">Động lực tiềm năng</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">{report.catalysts.map((item) => <li key={item}>• {item}</li>)}</ul></div><div><h3 className="text-sm font-bold text-bear">Rủi ro cần theo dõi</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">{report.risks.map((item) => <li key={item}>• {item}</li>)}</ul></div></div></div>
      <aside className="bg-slate-50 p-5 md:p-6"><h2 className="text-sm font-bold text-navy">Kịch bản xu hướng</h2><div className="mt-5 space-y-6">{report.forecasts.map((forecast) => <div key={forecast.horizon}><div className="flex items-center justify-between"><span className="font-mono text-sm font-bold">{forecast.horizon}</span><span className="text-xs font-semibold text-slate-600">{forecast.direction === "bullish" ? "Tăng" : forecast.direction === "bearish" ? "Giảm" : "Trung tính"}</span></div><div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`${forecast.horizon}: ${forecast.bullishProbability}% tăng, ${forecast.neutralProbability}% trung tính, ${forecast.bearishProbability}% giảm`}><span className="bg-bull" style={{ width: `${forecast.bullishProbability}%` }}/><span className="bg-slate-400" style={{ width: `${forecast.neutralProbability}%` }}/><span className="bg-bear" style={{ width: `${forecast.bearishProbability}%` }}/></div><p className="mt-2 font-mono text-[11px] text-slate-600">Tăng {forecast.bullishProbability}% · Trung tính {forecast.neutralProbability}% · Giảm {forecast.bearishProbability}%</p><p className="mt-2 text-xs leading-5 text-slate-600">{forecast.rationale}</p></div>)}</div><p className="mt-6 text-xs leading-5 text-slate-500">Xác suất do AI ước lượng, chưa được hiệu chỉnh và không phải mục tiêu giá hay cam kết lợi nhuận.</p></aside>
    </div>
    <div className="border-t border-slate-200 px-5 py-5 md:px-6"><h2 className="text-sm font-bold text-navy">Nguồn internet agent đã đọc</h2><div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">{report.citations.map((citation, index) => <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer" className="group grid gap-2 py-4 hover:bg-slate-50 sm:grid-cols-[32px_1fr_auto]"><span className="font-mono text-xs font-bold text-blue-800">[{index + 1}]</span><div><p className="text-sm font-semibold leading-5 text-navy group-hover:underline">{citation.title}</p><p className="mt-1 text-xs text-slate-500">{citation.source}{citation.documentType === "pdf" ? " · PDF" : " · Trang web"}{citation.publishedAt ? ` · ${new Date(citation.publishedAt).toLocaleDateString("vi-VN")}` : ""}{citation.facts?.length ? ` · ${citation.facts.length} dữ kiện` : ""}</p>{citation.insight && <p className="mt-2 text-xs leading-5 text-slate-600">{citation.insight}</p>}</div><ExternalLink className="hidden text-slate-400 sm:block" size={15}/></a>)}</div></div>
  </section>;
}
