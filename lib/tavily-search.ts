export type WebResearchSource = {
  title: string;
  url: string;
  content: string;
  publishedAt: string | null;
  source: string;
  documentType?: "html" | "pdf";
  retrievedAt?: string;
};

export type TavilySearchResult =
  | { ok: true; results: WebResearchSource[] }
  | { ok: false; status: number | null; message: string; detail: string };

export type TavilyExtractResult = TavilySearchResult;

export function isPublicWebUrl(value: string) {
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
  exchange,
  fetchImpl = fetch,
}: {
  apiKey: string;
  symbol: string;
  company: string;
  exchange: string;
  fetchImpl?: typeof fetch;
}): Promise<TavilySearchResult> {
  let response: Response;
  try {
    response = await fetchImpl("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `"${symbol}" "${company}" ${exchange} báo cáo tài chính BCTC PDF trang chứng khoán mới nhất EPS ROE P/E P/B nợ vốn chủ sở hữu cổ tức`,
        search_depth: "basic",
        chunks_per_source: 1,
        max_results: 6,
        topic: "general",
        time_range: "year",
        include_answer: false,
        include_raw_content: false,
        include_images: false,
        include_usage: true,
        auto_parameters: false,
        safe_search: true,
        exclude_domains: ["facebook.com", "reddit.com", "seekingalpha.com", "youtube.com", "tiktok.com", "x.com", "twitter.com"],
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
    const title = String(item.title ?? new URL(url).hostname).slice(0, 300);
    return [{
      title,
      url,
      content: String(item.content ?? "").slice(0, 700),
      publishedAt: item.published_date ? String(item.published_date) : null,
      source: new URL(url).hostname.replace(/^www\./, ""),
      documentType: (/\.pdf(?:$|[?#])/i.test(url) || /\bpdf\b/i.test(title) ? "pdf" : "html") as "pdf" | "html",
    }];
  });
  return { ok: true, results };
}

export async function extractFinancialWeb({
  apiKey,
  sources,
  symbol,
  fetchImpl = fetch,
}: {
  apiKey: string;
  sources: WebResearchSource[];
  symbol: string;
  fetchImpl?: typeof fetch;
}): Promise<TavilyExtractResult> {
  const officialDomains = /(^|\.)(hnx\.vn|hsx\.vn|hose\.vn|ssc\.gov\.vn)$/i;
  const candidates = sources
    .filter((source) => isPublicWebUrl(source.url))
    .sort((left, right) => {
      const score = (source: WebResearchSource) => officialDomains.test(new URL(source.url).hostname) ? 0 : source.documentType === "pdf" ? 1 : 2;
      return score(left) - score(right);
    })
    .slice(0, 5);
  if (!candidates.length) return { ok: true, results: [] };
  let response: Response;
  try {
    response = await fetchImpl("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: candidates.map((source) => source.url),
        query: `${symbol} báo cáo tài chính doanh thu lợi nhuận EPS ROE P/E P/B tài sản nợ vốn chủ sở hữu dòng tiền cổ tức`,
        extract_depth: "basic",
        chunks_per_source: 5,
        format: "markdown",
        include_images: false,
        include_usage: true,
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (caught) {
    return {
      ok: false,
      status: null,
      message: "Không thể đọc nội dung các nguồn tài chính trong thời gian cho phép.",
      detail: caught instanceof Error ? caught.message : String(caught),
    };
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1_000);
    return { ok: false, status: response.status, message: errorMessage(response.status), detail };
  }
  let body: { results?: Array<{ url?: unknown; raw_content?: unknown }> };
  try {
    body = await response.json();
  } catch {
    return { ok: false, status: 502, message: "Tavily trả về nội dung trích xuất không hợp lệ.", detail: "Invalid JSON" };
  }
  const byUrl = new Map(candidates.map((source) => [source.url, source]));
  const retrievedAt = new Date().toISOString();
  const extracted = (body.results ?? []).flatMap((item) => {
    const url = String(item.url ?? "");
    const original = byUrl.get(url);
    if (!original) return [];
    const raw = String(item.raw_content ?? "").replace(/\u0000/g, "").trim();
    return [{ ...original, content: raw.slice(0, 16_000) || original.content, retrievedAt }];
  });
  const extractedByUrl = new Map(extracted.map((source) => [source.url, source]));
  const resolved = candidates.map((source) => extractedByUrl.get(source.url) ?? source);
  const knownUrls = new Set(resolved.map((source) => source.url));
  const pdfAttachments = resolved.flatMap((source) => {
    const urls = source.content.match(/https?:\/\/[^\s)\]"']+\.pdf(?:\?[^\s)\]"']*)?/gi) ?? [];
    return urls.flatMap((url) => {
      const cleanUrl = url.replace(/[.,;]+$/, "");
      if (knownUrls.has(cleanUrl) || !isPublicWebUrl(cleanUrl)) return [];
      knownUrls.add(cleanUrl);
      return [{ title: `${source.title} — PDF đính kèm`, url: cleanUrl, content: source.content, publishedAt: source.publishedAt, source: new URL(cleanUrl).hostname.replace(/^www\./, ""), documentType: "pdf" as const, retrievedAt }];
    });
  }).slice(0, 2);
  return { ok: true, results: [...resolved, ...pdfAttachments].slice(0, 7) };
}

export async function searchSectorWeb({
  apiKey,
  sector,
  symbols,
  fetchImpl = fetch,
}: {
  apiKey: string;
  sector: string;
  symbols: string[];
  fetchImpl?: typeof fetch;
}): Promise<TavilySearchResult> {
  let response: Response;
  try {
    response = await fetchImpl("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `Thị trường chứng khoán Việt Nam ngành "${sector}" ${symbols.join(" ")} tin tức kết quả kinh doanh triển vọng rủi ro mới nhất`,
        search_depth: "basic",
        chunks_per_source: 1,
        max_results: 6,
        topic: "news",
        time_range: "month",
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
      message: "Tìm kiếm tin ngành bị quá thời gian. Hãy thử lại.",
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
      content: String(item.content ?? "").slice(0, 700),
      publishedAt: item.published_date ? String(item.published_date) : null,
      source: new URL(url).hostname.replace(/^www\./, ""),
    }];
  });
  return { ok: true, results };
}
