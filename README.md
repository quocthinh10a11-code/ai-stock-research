# AI Stock Research

Next.js 15 research workspace for Vietnamese equities on HOSE, HNX and UPCOM.

## Local setup

1. Install Node dependencies with `npm install`.
2. Keep Python packages on the project drive by creating and activating a project-local environment:

   ```powershell
   python -m venv .venv
   & ".\.venv\Scripts\Activate.ps1"
   python -m pip install -r requirements-market-data.txt
   ```

3. Copy `.env.example` to `.env.local`.
4. Add your Supabase project URL and publishable key.
5. Apply the SQL migrations in `supabase/migrations/` in filename order.
6. Run `npm run dev`.

## Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
SUPABASE_SECRET_KEY=sb_secret_your-key
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_MODELS=gemini-2.5-flash-lite,gemini-2.5-flash
GEMINI_SYNTHESIS_MODEL=gemini-3.6-flash
TAVILY_API_KEY=your-free-tavily-key
AI_DAILY_REQUEST_LIMIT=10
```

`GEMINI_MODEL` remains a supported legacy singular fallback when `GEMINI_MODELS` is not set. Tavily retrieval plus `GEMINI_SYNTHESIS_MODEL` is the primary path.

## Supabase setup

- Enable Email/Password in Authentication providers.
- Enable Google and add its Client ID and Client Secret.
- Add `http://localhost:3000/auth/callback` and the production callback URL to the redirect allow list.
- Run the market and company synchronization jobs with server-only Supabase credentials; never expose the secret/service-role key in the browser.

## Routes

- `/` redirects authenticated users to `/home` and other users to `/login`
- `/login` Supabase email/password and Google OAuth login
- `/home` authenticated ticker search and synchronized stocks
- `/analysis/[symbol]` authenticated stock research result
- `/discover` authenticated synchronized ranking and watchlist

Stock search, OHLCV, technical evidence and synchronized company fundamentals read from Supabase. The Live Internet Financial Research Agent runs when an analysis opens: Tavily discovers current Vietnamese financial sources, Tavily Extract reads bounded page/report content, and one structured Gemini inference extracts source-bound facts together with the cited four-group decision matrix. A public PDF up to 8 MB may also be read natively by Gemini after HTTPS, DNS, redirect and file-signature checks. Facts retain their reporting period, unit, source index, page and evidence; missing or unsupported metrics remain explicitly unavailable.

Live research is cache-first for 60 minutes and deduplicated per symbol. “Nghiên cứu lại” bypasses the source cache, while the free-safe global cap of 10 new AI runs per UTC day and stale-report fallback keep the structured dashboard available if Tavily or Gemini is unavailable. The cap remains 10 even if a larger environment value is configured because a live stock run can consume two focused Search credits and one Extract credit. Only bounded extracted text and provenance are cached; the application does not store complete articles or PDFs.

See [Realtime company research](docs/realtime-company-research.md) for data sync, free-tier limits and deployment secrets.
