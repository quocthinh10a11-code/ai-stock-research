import { AlertTriangle, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FreshnessInfo } from "@/types/stock";

const statusStyles: Record<FreshnessInfo["status"], string> = {
  Live: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Delayed: "border-amber-200 bg-amber-50 text-amber-800",
  EOD: "border-blue-200 bg-blue-50 text-blue-800",
  Cached: "border-slate-300 bg-slate-50 text-slate-700",
  Stale: "border-red-200 bg-red-50 text-red-800",
};

function formatTimestamp(value: string | null) {
  return value ? new Date(value).toLocaleString("vi-VN") : "Chưa xác minh";
}

export function FreshnessBadge({ freshness }: { freshness: FreshnessInfo }) {
  const source = freshness.sourceUrl ? (
    <a href={freshness.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
      {freshness.sourceName}
    </a>
  ) : <span className="font-semibold">{freshness.sourceName}</span>;

  return (
    <div className={cn("rounded-lg border px-3 py-2 text-xs", statusStyles[freshness.status])}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1 font-bold"><Clock3 size={13} aria-hidden="true" />{freshness.status}</span>
        <span>· {freshness.marketSession === "open" ? "Trong giờ giao dịch" : "Ngoài giờ giao dịch"}</span>
        <span>· Nguồn: {source}</span>
      </div>
      <p className="mt-1 leading-5 opacity-90">
        Thời điểm nguồn: {formatTimestamp(freshness.providerTimestamp)} · Lấy về: {formatTimestamp(freshness.fetchedAt)}
        {freshness.dataQuality ? ` · Chất lượng: ${freshness.dataQuality}` : ""}
      </p>
      {freshness.lastError && (
        <p className="mt-1 inline-flex items-start gap-1 font-semibold"><AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />Lỗi nguồn: {freshness.lastError}</p>
      )}
    </div>
  );
}
