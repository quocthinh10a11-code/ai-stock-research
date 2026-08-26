# AI Stock Research

Next.js 15 research workspace for Vietnamese equities, converted from the supplied Stitch designs.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add your Supabase project URL and publishable key.
4. Run `npm run dev`.

## Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
```

## Supabase setup

- Enable Email/Password in Authentication providers.
- Enable Google and add its Client ID and Client Secret.
- Add `http://localhost:3000/auth/callback` and the production callback URL to the redirect allow list.
- When production tables are added, explicitly expose only the required tables to the Data API, enable RLS on every exposed table, and add ownership-scoped policies.

## Routes

- `/` public market landing page
- `/login` Supabase email/password and Google OAuth login
- `/analysis/[symbol]` public stock research result
- `/overview`, `/discover`, `/technical`, `/sentiment`, `/portfolio` authenticated workspace

All market values are typed synthetic mock data. Replace the implementation inside `lib/data/` with Supabase queries when the production schema and data provider are ready.
