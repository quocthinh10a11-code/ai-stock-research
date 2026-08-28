export type WebResearchSource = {
  title: string;
  url: string;
  content: string;
  publishedAt: string | null;
  source: string;
};

type TavilySearchResult =
  | { ok: true; results: WebResearchSource[] }
  | { ok: false; status: number | null; message: string; detail: string };

function isPublicWebUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:")
      && url.hostname !== "localhost"
      && url.hostname !== "127.0.0.1"
      && url.hostname !== "0.0.0.0";
  } catch {
    return false;
  }
}

function errorMessage(status: number) {
  if (status === 401) return "TAVILY_API_KEY is invalid or inactive.";
  if (status === 429 || status === 432 || status === 433) return "Tavily's free monthly search quota is exhausted.";
  if (status >= 500) return "Tavily web search is temporarily unavailable.";
  return "Tavily could not complete the realtime financial search.";
}

export async function searchFinancialWeb({
  apiKey,
  symbol,
  company,
  fetchImpl = fetch,
}: {
  apiKey: string;
  symbol: string;
  company: string;
  fetchImpl?: typeof fetch;
}): Promise<TavilySearchResult> {
  let response: Response;
  try {
    response = await fetchImpl("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `"${company}" ${symbol} Vietnam financial results revenue profit earnings report stock`,
        search_depth: "basic",
        chunks_per_source: 2,
        max_results: 8,
        topic: "finance",
        time_range: "year",
        include_answer: false,
        include_raw_content: false,
        include_images: false,
        include_usage: true,
        auto_parameters: false,
        safe_search: true,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (caught) {
    return {
      ok: false,
      status: null,
      message: "Realtime web search timed out. Please retry.",
      detail: caught instanceof Error ? caught.message : String(caught),
    };
  }

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1_000);
    return { ok: false, status: response.status, message: errorMessage(response.status), detail };
  }

  let body: { results?: Array<{ title?: unknown; url?: unknown; content?: unknown; published_date?: unknown }> };
  try {
    body = await response.json();
  } catch {
    return { ok: false, status: 502, message: "Tavily returned an invalid response.", detail: "Invalid JSON" };
  }

  const results = (body.results ?? []).flatMap((item) => {
    const url = String(item.url ?? "");
    if (!isPublicWebUrl(url)) return [];
    return [{
      title: String(item.title ?? new URL(url).hostname).slice(0, 300),
      url,
      content: String(item.content ?? "").slice(0, 1_500),
      publishedAt: item.published_date ? String(item.published_date) : null,
      source: new URL(url).hostname.replace(/^www\./, ""),
    }];
  });
  return { ok: true, results };
}
