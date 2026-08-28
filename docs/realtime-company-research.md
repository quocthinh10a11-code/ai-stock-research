# Realtime company research

The analysis workspace combines four free-tier sources:

- VNStock Community for the HOSE, HNX and UPCOM catalog, OHLCV, and up to 20 financial-report periods.
- Tavily Search for current Vietnamese public URLs and source excerpts (free quota applies).
- Gemini 3.6 Flash for synthesis of Tavily results without the paid Google Search tool.
- Gemini 2.5 Flash-Lite Google Search grounding as a legacy fallback when Tavily is not configured.
- Supabase Free for public market data and a 15-minute AI research cache.

The database reserves each uncached provider request in an atomic UTC daily counter before calling external providers. When Tavily is configured, the default application limit is 30 requests/day so the 1,000-credit monthly free allowance lasts roughly a month. The hard database maximum remains 500.

## Apply the database migration

Run the migrations in filename order. Existing deployments must at least apply:

1. `supabase/migrations/20260826050000_expand_company_research.sql`
2. `supabase/migrations/20260828090000_add_ai_decision_matrix.sql`

## Required secrets

Add these server-only values to Vercel and GitHub Actions where applicable:

```text
SUPABASE_SECRET_KEY=<Supabase secret/service-role key>
GEMINI_API_KEY=<Google AI Studio free-tier key>
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_SYNTHESIS_MODEL=gemini-3.6-flash
TAVILY_API_KEY=<Tavily Researcher free-tier key>
AI_DAILY_REQUEST_LIMIT=30
```

Never prefix the Supabase secret key or Gemini key with `NEXT_PUBLIC_`.

## Initial synchronization

```powershell
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SECRET_KEY = "your-secret-key"
python scripts/sync_company_research.py
Remove-Item Env:SUPABASE_URL, Env:SUPABASE_SECRET_KEY
```

The default run loads the complete three-exchange catalog and refreshes the default universe plus up to 20 recently researched symbols. A search therefore runs web research immediately and joins the next scheduled structured-data refresh without a manual workflow run. To force an immediate refresh for selected tickers:

```powershell
$env:MARKET_SYMBOLS = "ACB,VGI"
$env:FUNDAMENTAL_SYMBOLS = "ACB,VGI"
python scripts/sync_market_data.py
python scripts/sync_company_research.py
Remove-Item Env:MARKET_SYMBOLS, Env:FUNDAMENTAL_SYMBOLS
```

The GitHub Actions workflow also accepts a comma-separated `symbols` input for manual refreshes.

## Free-tier boundaries

- Tavily basic search costs one credit and its free Researcher plan currently includes 1,000 credits per month. Once exhausted, requests stop until reset; the app never opts into pay-as-you-go.
- Gemini generation and legacy Search grounding remain quota-limited. The UI returns a clear provider-specific state instead of fabricating an answer.
- The application sends Tavily snippets as untrusted data and instructs Gemini to ignore instructions embedded in external content.
- Google states that free-tier Gemini inputs and outputs may be used to improve its products; do not send private portfolio notes in the research prompt.
- “Realtime” means information Tavily can retrieve at request time; exchange filings and publishers may themselves publish with delay.
- Predictions are scenario probabilities for 1, 3 and 6 months. They are not guaranteed returns or price targets.
- VNStock Community upstream endpoints and schemas can change, and the default free report depth is limited.
