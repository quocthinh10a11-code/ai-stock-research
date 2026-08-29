import { buildFreshness } from "./freshness.ts";
import type { CurrentMarketSnapshot, FreshnessInfo } from "../types/stock";

export interface ProgressiveMarketState {
  price: number | null;
  change: number | null;
  freshness: FreshnessInfo;
}

export function marketStateFromSnapshot(row: CurrentMarketSnapshot): ProgressiveMarketState {
  const price = row.close == null ? null : Number(row.close);
  const previous = row.previous_close == null ? price : Number(row.previous_close);
  const change = price != null && previous
    ? Number((((price - previous) / previous) * 100).toFixed(2))
    : null;
  return {
    price,
    change,
    freshness: buildFreshness({
      kind: "market",
      providerTimestamp: row.price_provider_timestamp ?? row.price_date,
      fetchedAt: row.price_fetched_at,
      expiresAt: row.price_expires_at,
      sourceName: row.price_source_name,
      sourceUrl: row.price_source_url,
      dataQuality: row.price_data_quality,
      lastError: row.price_last_error,
      refreshStatus: row.price_refresh_status,
    }),
  };
}

export function shouldRequestMarketRefresh(freshness: FreshnessInfo) {
  return freshness.status === "Stale" && freshness.refreshStatus !== "refreshing";
}
