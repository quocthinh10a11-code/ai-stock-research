import assert from "node:assert/strict";
import test from "node:test";
import { searchFinancialWeb } from "../lib/tavily-search.ts";

test("normalizes realtime Tavily finance results", async () => {
  const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body));
    assert.equal(request.topic, "finance");
    assert.equal(request.search_depth, "basic");
    assert.equal(request.max_results, 5);
    assert.equal(request.chunks_per_source, 1);
    return Response.json({ results: [{
      title: "FPT reports quarterly growth",
      url: "https://example.com/fpt-results",
      content: "Revenue and profit increased.",
      published_date: "2026-08-27",
    }] });
  }) as typeof fetch;

  const result = await searchFinancialWeb({ apiKey: "tvly-test", symbol: "FPT", company: "FPT Corporation", fetchImpl });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.results[0].source, "example.com");
    assert.equal(result.results[0].publishedAt, "2026-08-27");
  }
});

test("classifies exhausted Tavily free quota", async () => {
  const fetchImpl = (async () => new Response("limit reached", { status: 432 })) as typeof fetch;
  const result = await searchFinancialWeb({ apiKey: "tvly-test", symbol: "FPT", company: "FPT Corporation", fetchImpl });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /quota/i);
});
