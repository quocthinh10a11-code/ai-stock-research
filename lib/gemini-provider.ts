const FREE_GROUNDED_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"] as const;

type ProviderError = {
  httpStatus: number;
  message: string;
  providerStatus: number | null;
  detail: string;
};

type GroundedGeminiResult =
  | { ok: true; model: string; response: Response }
  | { ok: false; attemptedModels: string[]; error: ProviderError };

type SynthesisGeminiResult =
  | { ok: true; model: string; response: Response }
  | { ok: false; error: ProviderError };

function uniqueModels(models: string[]) {
  return [...new Set(models.map((model) => model.trim()).filter(Boolean))];
}

export function configuredGeminiModels(env: NodeJS.ProcessEnv = process.env) {
  const configuredList = env.GEMINI_MODELS?.split(",") ?? [];
  if (configuredList.some((model) => model.trim())) return uniqueModels(configuredList);
  return uniqueModels([env.GEMINI_MODEL ?? "", ...FREE_GROUNDED_MODELS]);
}

function providerMessage(status: number, detail: string): ProviderError {
  if (status === 400) return {
    httpStatus: 503,
    providerStatus: status,
    detail,
    message: "Gemini rejected the model or Google Search request. Check GEMINI_MODEL in Vercel.",
  };
  if (status === 401) return {
    httpStatus: 503,
    providerStatus: status,
    detail,
    message: "GEMINI_API_KEY is invalid or inactive. Create an active key in Google AI Studio and update Vercel.",
  };
  if (status === 403) return {
    httpStatus: 503,
    providerStatus: status,
    detail,
    message: "The Gemini project cannot use this model or Google Search grounding. Check the API key project and permissions.",
  };
  if (status === 404) return {
    httpStatus: 503,
    providerStatus: status,
    detail,
    message: "No configured Gemini model was found. Use gemini-2.5-flash-lite or gemini-2.5-flash.",
  };
  if (status === 429) return {
    httpStatus: 429,
    providerStatus: status,
    detail,
    message: "Gemini's free Google Search quota is exhausted for this API project. Check AI Studio Usage & Rate limits or retry after the quota resets.",
  };
  if (status === 503 || status >= 500) return {
    httpStatus: 502,
    providerStatus: status,
    detail,
    message: "Gemini is temporarily unavailable. Please retry shortly.",
  };
  return {
    httpStatus: 502,
    providerStatus: status,
    detail,
    message: "Gemini could not complete live web research. Check the Vercel function log for the provider response.",
  };
}

function canTryFallback(status: number, detail: string) {
  if (status === 404) return true;
  if (status !== 400) return false;
  return /model|not found|not supported|google.?search|tool/i.test(detail);
}

export async function requestGroundedGemini({
  apiKey,
  prompt,
  models = configuredGeminiModels(),
  fetchImpl = fetch,
}: {
  apiKey: string;
  prompt: string;
  models?: string[];
  fetchImpl?: typeof fetch;
}): Promise<GroundedGeminiResult> {
  const candidates = uniqueModels(models);
  if (candidates.length === 0) {
    return { ok: false, attemptedModels: [], error: providerMessage(404, "No model configured") };
  }

  for (const [index, model] of candidates.entries()) {
    let response: Response;
    try {
      response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(55_000),
      });
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught);
      return {
        ok: false,
        attemptedModels: candidates.slice(0, index + 1),
        error: { httpStatus: 502, providerStatus: null, detail, message: "Live research timed out or could not reach Gemini. Please retry." },
      };
    }

    if (response.ok) return { ok: true, model, response };

    const detail = (await response.text()).slice(0, 1_500);
    const hasFallback = index < candidates.length - 1;
    if (hasFallback && canTryFallback(response.status, detail)) continue;
    return {
      ok: false,
      attemptedModels: candidates.slice(0, index + 1),
      error: providerMessage(response.status, detail),
    };
  }

  return {
    ok: false,
    attemptedModels: candidates,
    error: providerMessage(404, "All configured models were unavailable"),
  };
}

export async function requestSynthesisGemini({
  apiKey,
  prompt,
  model = process.env.GEMINI_SYNTHESIS_MODEL ?? "gemini-3.6-flash",
  fetchImpl = fetch,
}: {
  apiKey: string;
  prompt: string;
  model?: string;
  fetchImpl?: typeof fetch;
}): Promise<SynthesisGeminiResult> {
  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.15,
          responseMimeType: "application/json",
          maxOutputTokens: 3_072,
          thinkingConfig: { thinkingLevel: "minimal" },
        },
      }),
      signal: AbortSignal.timeout(40_000),
    });
  } catch (caught) {
    const elapsedMs = Date.now() - startedAt;
    const detail = `${caught instanceof Error ? caught.name : "RequestError"}: ${caught instanceof Error ? caught.message : String(caught)} after ${elapsedMs}ms`;
    const timedOut = caught instanceof Error && (caught.name === "TimeoutError" || caught.name === "AbortError");
    return {
      ok: false,
      error: {
        httpStatus: 502,
        providerStatus: null,
        detail,
        message: timedOut ? "Gemini synthesis exceeded the response deadline. Please retry." : "Gemini synthesis could not reach the provider. Please retry.",
      },
    };
  }
  if (response.ok) return { ok: true, model, response };
  const detail = (await response.text()).slice(0, 1_500);
  if (response.status === 429) return {
    ok: false,
    error: { httpStatus: 429, providerStatus: 429, detail, message: "Gemini's free text-generation quota is exhausted. Retry after the quota resets." },
  };
  return { ok: false, error: providerMessage(response.status, detail) };
}
