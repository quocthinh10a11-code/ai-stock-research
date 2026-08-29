"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { FreshnessBadge } from "@/components/ui/FreshnessBadge";
import { marketStateFromSnapshot, shouldRequestMarketRefresh, type ProgressiveMarketState } from "@/lib/progressive-market";
import { createClient } from "@/lib/supabase/client";
import type { CurrentMarketSnapshot } from "@/types/stock";

type ConnectionMode = "connecting" | "realtime" | "polling";

const snapshotColumns = "symbol,price_date,close,previous_close,price_provider_timestamp,price_fetched_at,price_expires_at,price_source_name,price_source_url,price_data_quality,price_last_error,price_refresh_status";

export function ProgressiveMarketSnapshot({ initial }: { initial: CurrentMarketSnapshot }) {
  const [market, setMarket] = useState<ProgressiveMarketState>(() => marketStateFromSnapshot(initial));
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("connecting");

  useEffect(() => {
    const supabase = createClient();
    let pollingTimer: ReturnType<typeof setInterval> | undefined;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let subscribed = false;

    const applySnapshot = (row: CurrentMarketSnapshot) => setMarket(marketStateFromSnapshot(row));
    const poll = async () => {
      const { data } = await supabase
        .from("current_market_snapshots")
        .select(snapshotColumns)
        .eq("symbol", initial.symbol)
        .maybeSingle();
      if (data) applySnapshot(data as CurrentMarketSnapshot);
    };
    const startPolling = () => {
      if (pollingTimer) return;
      setConnectionMode("polling");
      void poll();
      pollingTimer = setInterval(() => void poll(), 30_000);
    };

    const channel = supabase
      .channel(`market-snapshot-${initial.symbol}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "current_market_snapshots",
          filter: `symbol=eq.${initial.symbol}`,
        },
        (payload) => {
          if (payload.new && Object.keys(payload.new).length > 0) applySnapshot(payload.new as unknown as CurrentMarketSnapshot);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          subscribed = true;
          setConnectionMode("realtime");
          if (pollingTimer) clearInterval(pollingTimer);
          pollingTimer = undefined;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          subscribed = false;
          startPolling();
        }
      });

    fallbackTimer = setTimeout(() => {
      if (!subscribed) startPolling();
    }, 8_000);

    if (shouldRequestMarketRefresh(market.freshness)) {
      void fetch(`/api/refresh/${encodeURIComponent(initial.symbol)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataTypes: ["market"] }),
      });
    }

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (pollingTimer) clearInterval(pollingTimer);
      void supabase.removeChannel(channel);
    };
  }, [initial.symbol]);

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="text-right">
        {market.price == null ? (
          <>
            <p className="text-sm font-bold text-warning">Chưa có giá đồng bộ</p>
            <p className="mt-1 text-xs text-slate-500">AI vẫn dùng nguồn web có dẫn chứng</p>
          </>
        ) : (
          <>
            <p className="font-mono text-3xl font-bold text-navy">{market.price.toLocaleString("vi-VN")} ₫</p>
            <p className={`mt-1 font-mono text-sm font-bold ${(market.change ?? 0) >= 0 ? "text-bull" : "text-bear"}`}>
              {(market.change ?? 0) >= 0 ? "+" : ""}{market.change ?? 0}%
            </p>
          </>
        )}
      </div>
      <FreshnessBadge freshness={market.freshness} />
      <p className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
        {market.freshness.refreshStatus === "refreshing" ? <RefreshCw size={12} className="animate-spin" /> : connectionMode === "polling" ? <WifiOff size={12} /> : <Wifi size={12} />}
        {market.freshness.refreshStatus === "refreshing"
          ? "Đang làm mới nền"
          : connectionMode === "realtime"
            ? "Tự cập nhật qua Realtime"
            : connectionMode === "polling"
              ? "Realtime gián đoạn · kiểm tra mỗi 30 giây"
              : "Đang kết nối cập nhật"}
      </p>
    </div>
  );
}
