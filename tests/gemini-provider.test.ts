import assert from "node:assert/strict";
import test from "node:test";
import { configuredGeminiModels, requestFinancialFactsGemini, requestGroundedGemini, requestSynthesisGemini } from "../lib/gemini-provider.ts";

test("uses free grounded 2.5 models by default", () => {
  assert.deepEqual(configuredGeminiModels({ NODE_ENV: "test" }), ["gemini-2.5-flash-lite", "gemini-2.5-flash"]);
});

test("falls back when a configured model does not exist", async () => {
  const requested: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    requested.push(String(input));
    if (requested.length === 1) return new Response('{"error":{"message":"model not found"}}', { status: 404 });
    return Response.json({ candidates: [] });
  }) as typeof fetch;

  const result = await requestGroundedGemini({
    apiKey: "test-key",
    prompt: "test",
    models: ["gemini-stale", "gemini-2.5-flash-lite"],
    fetchImpl,
  });

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.model, "gemini-2.5-flash-lite");
  assert.equal(requested.length, 2);
});

test("reports quota exhaustion without trying another shared free-tier model", async () => {
  let requests = 0;
  const fetchImpl = (async () => {
    requests += 1;
    return new Response('{"error":{"message":"quota exceeded"}}', { status: 429 });
  }) as typeof fetch;

  const result = await requestGroundedGemini({
    apiKey: "test-key",
    prompt: "test",
    models: ["gemini-2.5-flash-lite", "gemini-2.5-flash"],
    fetchImpl,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.httpStatus, 429);
    assert.match(result.error.message, /quota/i);
  }
  assert.equal(requests, 1);
});

test("identifies an invalid API key", async () => {
  const fetchImpl = (async () => new Response('{"error":{"message":"invalid key"}}', { status: 401 })) as typeof fetch;
  const result = await requestGroundedGemini({ apiKey: "bad-key", prompt: "test", fetchImpl });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error.message, /GEMINI_API_KEY/);
});

test("uses Gemini 3.6 for free synthesis without the Google Search tool", async () => {
  let requestBody: Record<string, unknown> = {};
  const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body));
    return Response.json({ candidates: [] });
  }) as typeof fetch;
  const result = await requestSynthesisGemini({ apiKey: "test-key", prompt: "source snippets", fetchImpl });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.model, "gemini-3.6-flash");
  assert.equal("tools" in requestBody, false);
  assert.deepEqual((requestBody.generationConfig as Record<string, unknown>).thinkingConfig, { thinkingLevel: "minimal" });
  assert.equal((requestBody.generationConfig as Record<string, unknown>).maxOutputTokens, 3_072);
});

test("does not misreport a network failure as a synthesis timeout", async () => {
  const fetchImpl = (async () => { throw new TypeError("fetch failed"); }) as typeof fetch;
  const result = await requestSynthesisGemini({ apiKey: "test-key", prompt: "source snippets", fetchImpl });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error.message, /could not reach/i);
});

test("sends a PDF inline only to the financial fact extraction request", async () => {
  let requestBody: { contents?: Array<{ parts?: Array<Record<string, unknown>> }> } = {};
  const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body));
    return Response.json({ candidates: [] });
  }) as typeof fetch;
  const result = await requestFinancialFactsGemini({ apiKey: "test-key", prompt: "extract", pdfBytes: new TextEncoder().encode("%PDF-test"), fetchImpl });
  assert.equal(result.ok, true);
  const parts = requestBody.contents?.[0]?.parts ?? [];
  assert.equal(parts.length, 2);
  assert.equal((parts[1].inline_data as Record<string, unknown>).mime_type, "application/pdf");
});
