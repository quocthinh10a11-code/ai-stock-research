import assert from "node:assert/strict";
import test from "node:test";
import { marketStateFromSnapshot, shouldRequestMarketRefresh } from "../lib/progressive-market.ts";
import type { CurrentMarketSnapshot } from "../types/stock";

function snapshot(overrides: Partial<CurrentMarketSnapshot> = {}): CurrentMarketSnapshot {
  return {
    symbol: "FPT",
    price_date: "2026-08-28",
    close: 102_000,
    previous_close: 100_000,
    price_provider_timestamp: "2026-08-28T15:00:00+07:00",
    price_fetched_at: "2026-08-28T08:15:00Z",
    price_expires_at: "2099-08-30T00:00:00Z",
    price_source_name: "vnstock-community-v4",
    price_source_url: null,
    price_data_quality: "eod",
    price_last_error: null,
    price_refresh_status: "ready",
    ...overrides,
  };
}

test("maps an aggregate row to display price and change", () => {
  const result = marketStateFromSnapshot(snapshot());
  assert.equal(result.price, 102_000);
  assert.equal(result.change, 2);
  assert.equal(result.freshness.status, "EOD");
});

test("requests stale data once unless a refresh is already running", () => {
  const stale = marketStateFromSnapshot(snapshot({ price_expires_at: "2026-08-28T00:00:00Z" })).freshness;
  assert.equal(shouldRequestMarketRefresh(stale), true);
  assert.equal(shouldRequestMarketRefresh({ ...stale, refreshStatus: "refreshing" }), false);
});

test("keeps the cached quote visible when the latest provider attempt failed", () => {
  const result = marketStateFromSnapshot(snapshot({ price_last_error: "provider timeout", price_refresh_status: "error" }));
  assert.equal(result.price, 102_000);
  assert.equal(result.freshness.status, "Stale");
  assert.equal(result.freshness.lastError, "provider timeout");
});
