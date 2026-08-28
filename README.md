# AI Stock Research

Next.js 15 research workspace for Vietnamese equities on HOSE, HNX and UPCOM, converted from the supplied Stitch designs.

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

- `/` public market landing page
- `/login` Supabase email/password and Google OAuth login
- `/analysis/[symbol]` authenticated stock research result
- `/overview`, `/discover`, `/technical`, `/sentiment`, `/portfolio` authenticated workspace

Stock search, OHLCV, technical evidence and company fundamentals read from Supabase. Tavily performs realtime finance search and Gemini 3.6 synthesizes its source excerpts without consuming Google Search grounding quota. The legacy Gemini 2.5 grounded-search path remains available when Tavily is not configured. Dashboard-only areas such as market-wide sentiment and model-portfolio yields remain clearly labeled mock or rule-based data.

See [Realtime company research](docs/realtime-company-research.md) for data sync, free-tier limits and deployment secrets.
