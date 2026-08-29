"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown, CircleHelp, X } from "lucide-react";
import { DisclaimerCard } from "./DisclaimerCard";
import { SectorAiInsight } from "./SectorAiInsight";
import { WatchlistButton } from "./WatchlistButton";
import { FreshnessBadge } from "@/components/ui/FreshnessBadge";
import { groupTopFiveBySector, type SectorRankingGroup } from "@/lib/data/group-sector-rankings";
import { sectorNames } from "@/lib/sector-taxonomy";
import { cn, formatVnd } from "@/lib/utils";
import type { RankingItem, ScreenerCriterion } from "@/types/stock";

const ALL_SECTORS = "Tất cả";

function formatNumber(value: number | undefined, suffix = "") {
  return value == null ? "—" : `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}${suffix}`;
}

function formatMarketCap(value: number | undefined) {
  return value == null ? "—" : `${Math.round(value / 1_000_000_000).toLocaleString("vi-VN")} tỷ ₫`;
}

function formatVolume(value: number | undefined) {
  return value == null ? "—" : `${Math.round(value).toLocaleString("vi-VN")} cp`;
}

function criterionValue(item: ScreenerCriterion) {
  if (item.value == null) return "Chưa xác minh";
  if (typeof item.value === "string") return item.value || "Chưa xác minh";
  if (item.key === "market_cap") return formatMarketCap(item.value);
  if (item.key === "average_volume20") return formatVolume(item.value);
  if (item.key === "price") return formatVnd(item.value);
  if (["profit_growth", "revenue_growth", "roe", "gross_margin", "dividend_yield", "nim", "npl", "llcr"].includes(item.key)) return formatNumber(item.value, "%");
  if (["debt_to_equity", "current_ratio", "inventory_turnover", "pe"].includes(item.key)) return formatNumber(item.value, "x");
  return formatNumber(item.value);
}

function CriterionIcon({ passed }: { passed: boolean | null }) {
  if (passed === true) return <Check size={14} className="text-bull" aria-label="Đạt" />;
  if (passed === false) return <X size={14} className="text-bear" aria-label="Không đạt" />;
  return <CircleHelp size={14} className="text-warning" aria-label="Chưa xác minh" />;
}

function SectorRankingCard({
  group,
  initialWatchlist,
}: {
  group: SectorRankingGroup;
  initialWatchlist: string[];
}) {
  return (
    <section className="panel overflow-hidden" aria-label={`Top cổ phiếu ngành ${group.sector}`}>
      <div className="panel-header">
        <div>
          <h2 className="text-lg font-bold text-navy">{group.sector}</h2>
          <p className="mt-1 text-xs text-slate-500">Ưu tiên mã đạt nhiều tiêu chí nhất</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          Top {group.items.length}
        </span>
      </div>

      <ol className="divide-y divide-slate-200">
        {group.items.map((item, index) => (
          <li key={item.symbol} className="p-4">
            <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3">
              <span className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                index === 0 ? "bg-navy text-white" : "bg-slate-100 text-slate-600",
              )}>
                {index + 1}
              </span>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/analysis/${item.symbol}`}
                    className="group inline-flex items-center gap-1 font-mono text-sm font-bold text-blue-800 hover:underline"
                  >
                    {item.symbol}
                    <ArrowUpRight size={13} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                  {item.exchange && <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{item.exchange}</span>}
                  <span className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-bold",
                    item.eligible ? "bg-emerald-100 text-emerald-800" : "bg-amber-50 text-amber-800",
                  )}>
                    {item.eligible ? "Đạt bộ lọc" : "Cần xem xét"}
                  </span>
                </div>
                <p className="truncate text-xs text-slate-600">{item.company}</p>
                {item.industry && <p className="mt-0.5 truncate text-[11px] text-slate-400">{item.industry}</p>}
              </div>

              <div className="text-right">
                <p className="data text-sm font-semibold text-navy">{formatVnd(item.price)}</p>
                <p className={cn("data text-xs", item.change >= 0 ? "text-bull" : "text-bear")}>
                  {item.change >= 0 ? "+" : ""}{item.change}%
                </p>
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-4">
              <div><dt className="text-slate-500">Vốn hóa</dt><dd className="mt-0.5 font-semibold text-navy">{formatMarketCap(item.marketCap)}</dd></div>
              <div><dt className="text-slate-500">KLGD TB20</dt><dd className="mt-0.5 font-semibold text-navy">{formatVolume(item.averageVolume20)}</dd></div>
              <div><dt className="text-slate-500">P/E</dt><dd className="mt-0.5 font-semibold text-navy">{formatNumber(item.pe, "x")}</dd></div>
              <div><dt className="text-slate-500">ROE 4 quý</dt><dd className="mt-0.5 font-semibold text-navy">{formatNumber(item.roe, "%")}</dd></div>
            </dl>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="data text-lg font-bold text-navy">{item.score}</span>
                <span className="ml-1 text-xs text-slate-500">/100 điểm</span>
                {item.availableCriteria != null && (
                  <span className="ml-2 text-xs text-slate-500">· đạt {item.passedCriteria}/{item.availableCriteria} tiêu chí có dữ liệu</span>
                )}
              </div>
              <WatchlistButton symbol={item.symbol} initiallySaved={initialWatchlist.includes(item.symbol)} />
            </div>

            {item.criteria && item.criteria.length > 0 && (
              <details className="mt-3 border-t border-slate-200 pt-3">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-blue-800">
                  Xem checklist screener <ChevronDown size={14} aria-hidden="true" />
                </summary>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {item.criteria.map((criterion) => (
                    <li key={criterion.key} className="flex items-start gap-2 text-xs">
                      <CriterionIcon passed={criterion.passed} />
                      <span>
                        <strong className="font-semibold text-slate-700">{criterion.label}:</strong>{" "}
                        <span className="text-slate-600">{criterionValue(criterion)} · mục tiêu {criterion.target}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function DiscoverClient({
  items,
  initialWatchlist = [],
}: {
  items: RankingItem[];
  initialWatchlist?: string[];
}) {
  const groups = useMemo(() => groupTopFiveBySector(items), [items]);
  const sectors = [ALL_SECTORS, ...sectorNames];
  const [active, setActive] = useState(ALL_SECTORS);
  const visibleGroups = active === ALL_SECTORS
    ? groups
    : groups.filter((group) => group.sector === active);
  const latestScreenedAt = items.find((item) => item.screenedAt)?.screenedAt;
  const rankingFreshness = items.find((item) => item.freshness)?.freshness;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-full gap-2 overflow-x-auto pb-2" aria-label="Lọc cổ phiếu theo ngành">
          {sectors.map((sector) => (
            <button
              key={sector}
              type="button"
              onClick={() => setActive(sector)}
              aria-pressed={active === sector}
              className={cn(
                "min-h-10 shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                active === sector
                  ? "border-navy bg-navy text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              {sector}
            </button>
          ))}
        </div>
        <div className="pb-2">{rankingFreshness
          ? <FreshnessBadge freshness={rankingFreshness}/>
          : <p className="text-xs text-slate-500">{latestScreenedAt ? `Dữ liệu lúc ${new Date(latestScreenedAt).toLocaleString("vi-VN")}` : "Đang dùng dữ liệu thị trường dự phòng"}</p>}
        </div>
      </div>

      {active === ALL_SECTORS ? (
        <div className="mt-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
          Chọn một ngành để AI tìm tin mới trên internet và giải thích top 5. Thứ hạng luôn do bộ screener định lượng quyết định.
        </div>
      ) : (
        <SectorAiInsight key={active} sector={active} />
      )}

      {visibleGroups.length > 0 ? (
        <div className={cn("mt-4 grid gap-5", active === ALL_SECTORS && "xl:grid-cols-2")}>
          {visibleGroups.map((group) => (
            <SectorRankingCard key={group.sector} group={group} initialWatchlist={initialWatchlist} />
          ))}
        </div>
      ) : (
        <div className="panel mt-4 p-10 text-center">
          <p className="text-sm font-semibold text-navy">Chưa có dữ liệu đạt điều kiện cho ngành này</p>
          <p className="mt-1 text-xs text-slate-500">Chạy đồng bộ screener đầy đủ rồi thử lại.</p>
        </div>
      )}

      <div className="mt-5"><DisclaimerCard /></div>
    </>
  );
}
