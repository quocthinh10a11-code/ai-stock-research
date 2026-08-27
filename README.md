# AI Stock Research

Next.js 15 research workspace for Vietnamese equities on HOSE, HNX and UPCOM, converted from the supplied Stitch designs.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add your Supabase project URL and publishable key.
4. Apply the SQL migrations in `supabase/migrations/` in filename order.
5. Run `npm run dev`.

## Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
SUPABASE_SECRET_KEY=sb_secret_your-key
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_MODEL=gemini-2.5-flash-lite
AI_DAILY_REQUEST_LIMIT=450
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

Stock search, OHLCV, technical evidence and company fundamentals read from Supabase. A server-side Gemini request adds current web-grounded insight with source links and a short cache. Dashboard-only areas such as market-wide sentiment and model-portfolio yields remain clearly labeled mock or rule-based data.

See [Realtime company research](docs/realtime-company-research.md) for data sync, free-tier limits and deployment secrets.
