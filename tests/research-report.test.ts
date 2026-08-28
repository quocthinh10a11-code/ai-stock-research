import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDecisionMatrix } from "../lib/research-report.ts";

test("normalizes four decision groups and leaves unsupported metrics empty", () => {
  const rows = normalizeDecisionMatrix([{ group: "business_performance", metrics: [{ name: "ROE", value: "18%", trend: "Ổn định", sourceIndices: [1, 9] }], action: "hold", confidence: "high", analysis: "ROE tốt.", rationale: "Theo dõi thêm." }], 2);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].metrics[0].value, "18%");
  assert.deepEqual(rows[0].metrics[0].sourceIndices, [1]);
  assert.equal(rows[1].action, "insufficient_data");
  assert.equal(rows[1].metrics[0].value, null);
});
