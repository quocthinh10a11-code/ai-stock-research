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
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_SYNTHESIS_MODEL=gemini-3.6-flash
TAVILY_API_KEY=your-free-tavily-key
AI_DAILY_REQUEST_LIMIT=30
```

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

Stock search, OHLCV, technical evidence and company fundamentals read from Supabase. Tavily performs exchange-aware Vietnamese web search and Gemini 3.6 synthesizes cited source excerpts into a four-group indicator-to-decision matrix. Missing metrics remain explicitly unavailable. The scheduled job refreshes the default universe plus recently researched symbols, so HOSE, HNX and UPCOM searches do not require a workflow run per request.

See [Realtime company research](docs/realtime-company-research.md) for data sync, free-tier limits and deployment secrets.
