import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRefreshDataTypes, staleStructuredDataTypes } from "../lib/refresh-contract.ts";

test("defaults targeted refresh to market and fundamentals", () => {
  assert.deepEqual(normalizeRefreshDataTypes(undefined), ["market", "fundamentals"]);
});

test("deduplicates valid refresh data types", () => {
  assert.deepEqual(normalizeRefreshDataTypes(["market", "MARKET", "disclosures"]), ["market", "disclosures"]);
});

test("rejects unsupported or oversized refresh requests", () => {
  assert.throws(() => normalizeRefreshDataTypes(["portfolio"]), /unsupported/);
  assert.throws(() => normalizeRefreshDataTypes(["market", "fundamentals", "disclosures", "other"]), /between 1 and 3/);
});

test("queues only missing or expired structured datasets", () => {
  const now = new Date("2026-08-29T03:00:00.000Z");
  assert.deepEqual(staleStructuredDataTypes({
    marketExpiresAt: "2026-08-29T02:59:59.000Z",
    fundamentalsExpiresAt: "2026-09-01T00:00:00.000Z",
  }, now), ["market"]);
  assert.deepEqual(staleStructuredDataTypes({}, now), ["market", "fundamentals"]);
});
