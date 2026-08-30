import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFinancialFacts } from "../lib/live-financial-research.ts";
import { fetchPublicPdf, isPublicIp } from "../lib/safe-document-fetch.ts";

test("rejects private, loopback and link-local document addresses", () => {
  for (const address of ["127.0.0.1", "10.1.2.3", "172.16.1.1", "192.168.1.1", "169.254.1.1", "::1", "fd00::1", "fe80::1"]) {
    assert.equal(isPublicIp(address), false, address);
  }
  assert.equal(isPublicIp("8.8.8.8"), true);
  assert.equal(isPublicIp("2606:4700:4700::1111"), true);
});

test("validates PDF signature and follows only revalidated redirects", async () => {
  const visited: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    visited.push(String(input));
    if (visited.length === 1) return new Response(null, { status: 302, headers: { location: "https://cdn.example.com/report.pdf" } });
    return new Response(new TextEncoder().encode("%PDF-test"), { status: 200, headers: { "content-type": "application/pdf" } });
  }) as typeof fetch;
  const result = await fetchPublicPdf({ url: "https://example.com/report", fetchImpl, lookup: async () => ["8.8.8.8"] });
  assert.equal(result.bytes.byteLength, 9);
  assert.equal(visited.length, 2);
});

test("keeps only evidenced, source-bound financial facts", () => {
  const sources = [{ title: "MBS Q2", url: "https://example.com/mbs", content: "EPS cơ bản đạt 1.250 đồng/cp", publishedAt: null, source: "example.com", documentType: "html" as const }];
  const facts = normalizeFinancialFacts([
    { metric: "eps", label: "EPS", value: "1.250", period: "Q2/2026", unit: "VND/cp", sourceIndex: 1, page: 12, evidence: "EPS cơ bản đạt 1.250 đồng/cp", confidence: "high" },
    { metric: "eps", label: "EPS", value: "999", sourceIndex: 4, evidence: "outside source range" },
    { metric: "invented", value: "10", sourceIndex: 1, evidence: "unsupported metric" },
    { metric: "roe", value: "14%", sourceIndex: 1, evidence: "" },
    { metric: "pe", value: "19,6", sourceIndex: 1, evidence: "P/E đạt 19,6 lần" },
  ], sources);
  assert.equal(facts.length, 1);
  assert.equal(facts[0].metric, "eps");
  assert.equal(facts[0].page, 12);
});
