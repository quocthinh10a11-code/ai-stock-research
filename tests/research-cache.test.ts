import assert from "node:assert/strict";
import test from "node:test";
import { hashResearchInput, hashWebSources, isFreshIso, parseWebSources, stableSerialize } from "../lib/research-cache.ts";

test("stable serialization ignores object key order but preserves array order", () => {
  assert.equal(stableSerialize({ b: 2, a: { d: 4, c: 3 } }), stableSerialize({ a: { c: 3, d: 4 }, b: 2 }));
  assert.notEqual(hashResearchInput(["FPT", "MBB"]), hashResearchInput(["MBB", "FPT"]));
});

test("research hash changes only when an input value changes", () => {
  const first = hashResearchInput({ symbol: "FPT", price: 100, fetchedAt: undefined });
  const reordered = hashResearchInput({ price: 100, symbol: "FPT" });
  const changed = hashResearchInput({ symbol: "FPT", price: 101 });
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, reordered);
  assert.notEqual(first, changed);
});

test("web source hash includes source content and order", () => {
  const source = { title: "Report", url: "https://example.com/report", content: "Profit rose", publishedAt: null, source: "example.com" };
  assert.equal(hashWebSources([source]), hashWebSources([{ ...source }]));
  assert.notEqual(hashWebSources([source]), hashWebSources([{ ...source, content: "Profit fell" }]));
});

test("cached sources are validated and expiry is explicit", () => {
  assert.equal(parseWebSources([{ title: "Valid", url: "https://example.com", content: "x", source: "example.com" }]).length, 1);
  assert.equal(parseWebSources([{ title: "Invalid", url: "javascript:alert(1)" }]).length, 0);
  assert.equal(isFreshIso("2030-01-01T00:00:00.000Z", Date.parse("2029-01-01T00:00:00.000Z")), true);
  assert.equal(isFreshIso("invalid"), false);
});
