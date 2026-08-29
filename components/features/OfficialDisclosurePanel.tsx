"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { FreshnessBadge } from "@/components/ui/FreshnessBadge";
import { buildFreshness } from "@/lib/freshness";
import { createClient } from "@/lib/supabase/client";
import type { FreshnessInfo, OfficialDisclosure } from "@/types/stock";

export function OfficialDisclosurePanel({ symbol, initialItems, initialFreshness }: {
  symbol: string;
  initialItems: OfficialDisclosure[];
  initialFreshness: FreshnessInfo;
}) {
  const [items, setItems] = useState(initialItems);
  const [freshness, setFreshness] = useState(initialFreshness);

  useEffect(() => {
    if (initialFreshness.status !== "Stale") return;
    const supabase = createClient();
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    const poll = async () => {
      const [{ data: rows }, { data: status }] = await Promise.all([
        supabase.from("official_disclosures").select("title,excerpt,published_at,source_name,source_url").eq("symbol", symbol).order("published_at", { ascending: false }).limit(5),
        supabase.from("disclosure_sync_status").select("source_name,provider_timestamp,fetched_at,expires_at,data_quality,last_error,refresh_status").eq("symbol", symbol).maybeSingle(),
      ]);
      if (!active || !status) return;
      setItems((rows ?? []).map((row) => ({
        title: row.title,
        excerpt: row.excerpt,
        publishedAt: row.published_at,
        sourceName: row.source_name,
        sourceUrl: row.source_url,
      })));
      setFreshness(buildFreshness({
        kind: "disclosures",
        providerTimestamp: status.provider_timestamp,
        fetchedAt: status.fetched_at,
        expiresAt: status.expires_at,
        sourceName: status.source_name,
        sourceUrl: initialFreshness.sourceUrl,
        dataQuality: status.data_quality,
        lastError: status.last_error,
        refreshStatus: status.refresh_status,
      }));
      if (status.refresh_status === "ready" && status.expires_at && new Date(status.expires_at).getTime() > Date.now() && timer) {
        clearInterval(timer);
        timer = undefined;
      }
    };

    if (initialFreshness.refreshStatus !== "refreshing") {
      void fetch(`/api/refresh/${encodeURIComponent(symbol)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataTypes: ["disclosures"] }),
      });
    }
    timer = setInterval(() => void poll(), 30_000);
    return () => { active = false; if (timer) clearInterval(timer); };
  }, [initialFreshness, symbol]);

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 md:px-6">
        <div className="flex items-center gap-2"><FileText size={18} className="text-blue-800"/><h2 className="font-bold text-navy">Công bố thông tin chính thức</h2></div>
        <FreshnessBadge freshness={freshness}/>
      </header>
      {items.length > 0 ? (
        <div className="divide-y divide-slate-200">
          {items.map((item) => (
            <a key={item.sourceUrl} href={item.sourceUrl} target="_blank" rel="noreferrer" className="grid gap-2 px-5 py-4 hover:bg-slate-50 md:grid-cols-[130px_1fr_auto] md:px-6">
              <p className="text-xs font-semibold text-slate-500">{new Date(item.publishedAt).toLocaleString("vi-VN")}</p>
              <div><p className="text-sm font-semibold text-navy">{item.title}</p>{item.excerpt && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{item.excerpt}</p>}<p className="mt-1 text-[11px] text-slate-500">{item.sourceName}</p></div>
              <ExternalLink size={15} className="hidden text-slate-400 md:block"/>
            </a>
          ))}
        </div>
      ) : <p className="px-5 py-6 text-sm text-slate-600 md:px-6">Chưa ghi nhận công bố mới từ nguồn sở giao dịch trong cửa sổ dữ liệu hiện có.</p>}
    </section>
  );
}
