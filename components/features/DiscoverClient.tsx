"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DisclaimerCard } from "./DisclaimerCard";
import { RatingBadge } from "./RatingBadge";
import { WatchlistButton } from "./WatchlistButton";
import { groupTopFiveBySector, type SectorRankingGroup } from "@/lib/data/group-sector-rankings";
import { cn, formatVnd } from "@/lib/utils";
import type { RankingItem } from "@/types/stock";

const ALL_SECTORS = "Tất cả";

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
          <p className="label text-blue-800">Xếp hạng ngành</p>
          <h2 className="mt-1 text-lg font-bold text-navy">
            {group.sector}
          </h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          Top {group.items.length}
        </span>
      </div>

      <ol className="divide-y divide-slate-200">
        {group.items.map((item, index) => (
          <li
            key={item.symbol}
            className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto_auto]"
          >
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                index === 0 ? "bg-navy text-white" : "bg-slate-100 text-slate-600",
              )}
            >
              {index + 1}
            </span>

            <div className="min-w-0">
              <Link
                href={`/analysis/${item.symbol}`}
                className="group inline-flex items-center gap-1 font-mono text-sm font-bold text-blue-800 hover:underline"
              >
                {item.symbol}
                <ArrowUpRight
                  size={13}
                  className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <p className="truncate text-xs text-slate-500">{item.company}</p>
            </div>

            <div className="text-right">
              <p className="data text-sm font-semibold text-navy">{formatVnd(item.price)}</p>
              <p className={cn("data text-xs", item.change >= 0 ? "text-bull" : "text-bear")}>
                {item.change >= 0 ? "+" : ""}{item.change}%
              </p>
            </div>

            <div className="col-span-2 col-start-2 flex items-center justify-between gap-3 sm:col-span-1 sm:col-start-auto sm:justify-end">
              <div className="flex items-center gap-2">
                <span className="data text-xs font-semibold text-slate-500">{item.score}/100</span>
                <RatingBadge rating={item.rating} />
              </div>
              <WatchlistButton symbol={item.symbol} initiallySaved={initialWatchlist.includes(item.symbol)} />
            </div>
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
  const sectors = [ALL_SECTORS, ...groups.map((group) => group.sector)];
  const [active, setActive] = useState(ALL_SECTORS);
  const visibleGroups = active === ALL_SECTORS
    ? groups
    : groups.filter((group) => group.sector === active);

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Lọc cổ phiếu theo ngành">
        {sectors.map((sector) => (
          <button
            key={sector}
            type="button"
            onClick={() => setActive(sector)}
            aria-pressed={active === sector}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
              active === sector
                ? "border-navy bg-navy text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            {sector}
          </button>
        ))}
      </div>

      {visibleGroups.length > 0 ? (
        <div className={cn("mt-4 grid gap-5", active === ALL_SECTORS && "xl:grid-cols-2")}>
          {visibleGroups.map((group) => (
            <SectorRankingCard key={group.sector} group={group} initialWatchlist={initialWatchlist} />
          ))}
        </div>
      ) : (
        <div className="panel mt-4 p-10 text-center">
          <p className="text-sm font-semibold text-navy">Chưa có dữ liệu xếp hạng ngành</p>
          <p className="mt-1 text-xs text-slate-500">Hãy đồng bộ dữ liệu thị trường rồi thử lại.</p>
        </div>
      )}

      <div className="mt-5">
        <DisclaimerCard />
      </div>
    </>
  );
}
