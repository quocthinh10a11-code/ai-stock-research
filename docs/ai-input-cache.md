# AI cache keyed by evidence

Phase F separates source retrieval from AI synthesis and makes both safe to reuse.

## Cache identity

- Stock reports hash the symbol metadata, current price/change, technical evidence, quarterly financial values, official disclosure IDs, and the normalized web-source set.
- Sector briefs hash the deterministic top-five ranking and its metrics plus the normalized web-source set.
- Fetch timestamps are deliberately excluded. A newer fetch of identical evidence does not spend another Tavily or Gemini request.
- Tavily source excerpts are stored for 60 minutes for a stock and 30 minutes for a sector. Only the title, URL, publication date, bounded excerpt, provider, and content hash are retained.

## Duplicate collapse and quota

`research_runs` provides a two-minute cross-instance lease for one input hash. The first request owns the provider call; concurrent requests receive HTTP 202 and the UI retries with a bounded delay. A daily budget is reserved only after the lease is acquired. Telemetry distinguishes stock calls, sector calls, cache hits, collapsed duplicates, and failures.

The internal source cache and run table have RLS enabled, no anon/authenticated grants, and service-role-only access. AI results remain public market data, while route execution still requires an authenticated user.

## Failure behavior

If Tavily, Gemini, parsing, or quota checks fail, the route returns the latest valid cited report when one exists and marks it as cached/stale at the UI freshness layer. Structured market, technical, financial, and disclosure cards never depend on AI success.

The legacy Gemini Google Search path remains available when `TAVILY_API_KEY` is absent. Its input hash includes a 15-minute time bucket because the grounding source set is not available before the provider call.
