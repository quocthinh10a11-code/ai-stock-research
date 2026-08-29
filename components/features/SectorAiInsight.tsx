"use client";

import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import type { SectorAiBrief } from "@/types/stock";
import { FreshnessBadge } from "@/components/ui/FreshnessBadge";
import { buildFreshness } from "@/lib/freshness";

export function SectorAiInsight({ sector }: { sector: string }) {
  const [brief, setBrief] = useState<SectorAiBrief | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const freshness = brief ? buildFreshness({ kind: "ai", providerTimestamp: brief.asOf, fetchedAt: brief.asOf, expiresAt: brief.expiresAt, sourceName: "Tavily + Gemini", sourceUrl: null, dataQuality: "verified-sources", lastError: null, refreshStatus: "ready" }) : null;

  useEffect(() => {
    const controller = new AbortController();
    setBrief(null);
    setError("");
    void (async () => {
      for (let retry = 0; retry < 8; retry += 1) {
        const response = await fetch("/api/discover/sector", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sector }), signal: controller.signal,
        });
        const payload = await response.json() as SectorAiBrief | { pending?: boolean; retryAfterMs?: number; error?: string };
        if (response.status === 202 && "pending" in payload) {
          await new Promise((resolve) => setTimeout(resolve, Math.max(1_000, Math.min(Number(payload.retryAfterMs ?? 2_500), 5_000))));
          if (controller.signal.aborted) return;
          continue;
        }
        if (!response.ok) throw new Error("error" in payload ? payload.error : "Không thể tải AI insight theo ngành.");
        setBrief(payload as SectorAiBrief);
        return;
      }
      throw new Error("AI insight đang được xử lý lâu hơn dự kiến. Hãy thử lại sau ít phút.");
    })().catch((caught) => {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "Không thể tải AI insight theo ngành.");
    });
    return () => controller.abort();
  }, [sector, attempt]);

  return (
    <section className="panel mt-4 overflow-hidden" aria-live="polite">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Sparkles size={17} className="text-blue-800" aria-hidden="true" />
          <h2 className="font-bold text-navy">AI insight mới nhất · {sector}</h2>
        </div>
        {brief && freshness && <FreshnessBadge freshness={freshness}/>}
      </div>

      {!brief && !error && (
        <div className="space-y-3 p-5" role="status">
          <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-3/5 animate-pulse rounded bg-slate-200" />
          <p className="text-xs text-slate-500">Đang tìm tin mới và đối chiếu với top 5 của ngành…</p>
        </div>
      )}

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-semibold text-bear">Chưa tải được AI insight</p>
            <p className="mt-1 text-xs text-slate-600">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-navy hover:bg-slate-50"
          >
            <RefreshCw size={15} aria-hidden="true" /> Thử lại
          </button>
        </div>
      )}

      {brief && (
        <div className="p-5">
          <p className="max-w-4xl text-sm leading-6 text-slate-700">{brief.summary}</p>
          {brief.highlights.length > 0 && (
            <ul className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
              {brief.highlights.map((highlight) => (
                <li key={highlight} className="rounded-lg bg-slate-50 px-3 py-2 leading-5">{highlight}</li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-200 pt-4">
            {brief.citations.map((citation) => (
              <a
                key={citation.url}
                href={citation.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-800 underline-offset-4 hover:underline"
              >
                {citation.source ?? citation.title}
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-4 text-slate-500">
            AI chỉ diễn giải dữ liệu screener và nguồn web; thứ hạng do bộ quy tắc định lượng quyết định.
          </p>
        </div>
      )}
    </section>
  );
}
