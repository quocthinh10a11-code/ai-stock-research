# Realtime company research

The analysis workspace combines three free-tier sources:

- VNStock Community for the HOSE, HNX and UPCOM catalog, OHLCV, and up to eight default financial-report periods.
- Gemini 2.5 Flash-Lite with Google Search grounding for current web synthesis and citations.
- Supabase Free for public market data and a 15-minute AI research cache.

The database reserves each uncached provider request in an atomic UTC daily counter before calling Gemini. The default application limit is 450 requests and cannot be configured above 500.

## Apply the database migration

Run `supabase/migrations/20260826050000_expand_company_research.sql` in the Supabase SQL Editor, or use `npx supabase db push` after linking the project.

## Required secrets

Add these server-only values to Vercel and GitHub Actions where applicable:

```text
SUPABASE_SECRET_KEY=<Supabase secret/service-role key>
GEMINI_API_KEY=<Google AI Studio free-tier key>
GEMINI_MODEL=gemini-2.5-flash-lite
AI_DAILY_REQUEST_LIMIT=450
```

Never prefix the Supabase secret key or Gemini key with `NEXT_PUBLIC_`.

## Initial synchronization

```powershell
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SECRET_KEY = "your-secret-key"
python scripts/sync_company_research.py
Remove-Item Env:SUPABASE_URL, Env:SUPABASE_SECRET_KEY
```

The default run loads the complete three-exchange catalog and fundamentals for the initial tracked universe. To refresh any other listed ticker:

```powershell
$env:MARKET_SYMBOLS = "ACB,VGI"
$env:FUNDAMENTAL_SYMBOLS = "ACB,VGI"
python scripts/sync_market_data.py
python scripts/sync_company_research.py
Remove-Item Env:MARKET_SYMBOLS, Env:FUNDAMENTAL_SYMBOLS
```

The GitHub Actions workflow also accepts a comma-separated `symbols` input for manual refreshes.

## Free-tier boundaries

- Search grounding and model calls are quota-limited. The UI returns a clear retry/quota state instead of fabricating an answer.
- The default application cap leaves headroom below the currently documented 500 grounded Flash/Flash-Lite searches per day.
- Google states that free-tier Gemini inputs and outputs may be used to improve its products; do not send private portfolio notes in the research prompt.
- “Realtime” means information available to Google Search at request time; exchange filings and publishers may themselves publish with delay.
- Predictions are scenario probabilities for 1, 3 and 6 months. They are not guaranteed returns or price targets.
- VNStock Community upstream endpoints and schemas can change, and the default free report depth is limited.
