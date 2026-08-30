import assert from "node:assert/strict";
import test from "node:test";
import { extractFinancialWeb, searchFinancialWeb, searchSectorWeb } from "../lib/tavily-search.ts";

test("normalizes Vietnamese exchange-aware Tavily results", async () => {
  const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body));
    assert.equal(request.topic, "general");
    assert.match(request.query, /MBS/);
    assert.match(request.query, /HNX/);
    assert.equal(request.search_depth, "basic");
    assert.equal(request.max_results, 6);
    assert.equal(request.chunks_per_source, 1);
    assert.ok(request.exclude_domains.includes("facebook.com"));
    assert.ok(request.exclude_domains.includes("finance.yahoo.com"));
    return Response.json({ results: [{
      title: "FPT reports quarterly growth",
      url: "https://example.com/fpt-results",
      content: "Revenue and profit increased.",
      published_date: "2026-08-27",
    }] });
  }) as typeof fetch;

  const result = await searchFinancialWeb({ apiKey: "tvly-test", symbol: "MBS", company: "Công ty Cổ phần Chứng khoán MB", exchange: "HNX", fetchImpl });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.results[0].source, "example.com");
    assert.equal(result.results[0].publishedAt, "2026-08-27");
  }
});

test("extracts bounded full-page financial content from discovered URLs", async () => {
  const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body));
    assert.equal(request.extract_depth, "basic");
    assert.equal(request.chunks_per_source, 5);
    assert.deepEqual(request.urls, ["https://example.com/mbs.pdf"]);
    return Response.json({ results: [{ url: "https://example.com/mbs.pdf", raw_content: "Doanh thu quý II và lợi nhuận sau thuế. File: https://files.example.com/mbs-q2.pdf" }] });
  }) as typeof fetch;
  const result = await extractFinancialWeb({ apiKey: "tvly-test", symbol: "MBS", sources: [{ title: "BCTC MBS", url: "https://example.com/mbs.pdf", content: "excerpt", publishedAt: null, source: "example.com", documentType: "pdf" }], fetchImpl });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.match(result.results[0].content, /lợi nhuận sau thuế/);
    assert.equal(result.results[0].documentType, "pdf");
    assert.ok(result.results[0].retrievedAt);
    assert.equal(result.results[1].url, "https://files.example.com/mbs-q2.pdf");
  }
});

test("classifies exhausted Tavily free quota", async () => {
  const fetchImpl = (async () => new Response("limit reached", { status: 432 })) as typeof fetch;
  const result = await searchFinancialWeb({ apiKey: "tvly-test", symbol: "FPT", company: "FPT Corporation", exchange: "HOSE", fetchImpl });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /quota/i);
});

test("uses a separate compact query for live valuation metrics", async () => {
  const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body));
    assert.match(request.query, /P\/E P\/B EPS ROE/);
    return Response.json({ results: [] });
  }) as typeof fetch;
  const result = await searchFinancialWeb({ apiKey: "tvly-test", symbol: "MBS", company: "CTCP Chứng khoán MB", exchange: "HNX", intent: "metrics", fetchImpl });
  assert.equal(result.ok, true);
});

test("searches fresh sector news for the screened symbols", async () => {
  const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body));
    assert.equal(request.topic, "news");
    assert.equal(request.time_range, "month");
    assert.match(request.query, /Công nghệ thông tin/);
    assert.match(request.query, /FPT CMG/);
    return Response.json({ results: [{
      title: "Tin ngành công nghệ",
      url: "https://example.com/cong-nghe",
      content: "Thông tin mới.",
      published_date: "2026-08-28",
    }] });
  }) as typeof fetch;

  const result = await searchSectorWeb({ apiKey: "tvly-test", sector: "Công nghệ thông tin", symbols: ["FPT", "CMG"], fetchImpl });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.results[0].publishedAt, "2026-08-28");
});
