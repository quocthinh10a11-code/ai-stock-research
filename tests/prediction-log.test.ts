import assert from "node:assert/strict";
import test from "node:test";
import { buildPredictionRows } from "../lib/prediction-log.ts";

test("creates deduplicable 1M/3M/6M prediction rows with evidence and entry price", () => {
  const rows = buildPredictionRows({
    symbol: "SHB",
    asOf: "2026-08-31T10:00:00.000Z",
    entryPrice: 12_200,
    evidenceSnapshotId: 42,
    inputHash: "abc",
    forecasts: [
      { horizon: "1M", direction: "neutral", bullishProbability: 35, neutralProbability: 45, bearishProbability: 20, rationale: "test" },
      { horizon: "3M", direction: "bullish", bullishProbability: 50, neutralProbability: 30, bearishProbability: 20, rationale: "test" },
      { horizon: "6M", direction: "bearish", bullishProbability: 20, neutralProbability: 30, bearishProbability: 50, rationale: "test" },
    ],
  });

  assert.deepEqual(rows.map((row) => row.target_check_date), ["2026-09-30", "2026-11-30", "2027-02-28"]);
  assert.equal(rows[0].evidence_snapshot_id, 42);
  assert.equal(JSON.parse(rows[0].scenario_text).entryPrice, 12_200);
  assert.equal(JSON.parse(rows[0].scenario_text).inputHash, "abc");
});
