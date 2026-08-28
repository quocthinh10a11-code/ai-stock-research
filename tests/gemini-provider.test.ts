import assert from "node:assert/strict";
import test from "node:test";
import { configuredGeminiModels, requestGroundedGemini } from "../lib/gemini-provider.ts";

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
