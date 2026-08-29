import assert from "node:assert/strict";
import test from "node:test";
import { buildFreshness, getVietnamMarketSession } from "../lib/freshness.ts";

const base = {
  providerTimestamp: "2026-08-28T08:00:00.000Z",
  fetchedAt: "2026-08-28T08:01:00.000Z",
  sourceName: "vnstock-community-v4",
  sourceUrl: null,
  dataQuality: "delayed",
  lastError: null,
  refreshStatus: "ready",
};

test("marks an expired dataset stale even when its normal contract is delayed", () => {
  const result = buildFreshness({
    ...base,
    kind: "sector",
    expiresAt: "2026-08-28T08:30:00.000Z",
    now: new Date("2026-08-28T08:31:00.000Z"),
  });
  assert.equal(result.status, "Stale");
});

test("keeps daily price data explicitly labeled EOD", () => {
  const result = buildFreshness({
    ...base,
    kind: "market",
    dataQuality: "eod",
    expiresAt: "2026-08-30T00:00:00.000Z",
    now: new Date("2026-08-28T09:00:00.000Z"),
  });
  assert.equal(result.status, "EOD");
});

test("does not present legacy rows with an unknown fetch time as fresh", () => {
  const result = buildFreshness({
    ...base,
    kind: "market",
    fetchedAt: null,
    expiresAt: null,
    now: new Date("2026-08-28T09:00:00.000Z"),
  });
  assert.equal(result.status, "Stale");
});

test("reports Vietnam exchange sessions without depending on the host timezone", () => {
  assert.equal(getVietnamMarketSession(new Date("2026-08-28T03:00:00.000Z")), "open");
  assert.equal(getVietnamMarketSession(new Date("2026-08-29T03:00:00.000Z")), "closed");
});
