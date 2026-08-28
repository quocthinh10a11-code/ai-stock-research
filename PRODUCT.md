# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 15 App Router, TypeScript, Tailwind CSS, Supabase Auth and PostgreSQL with RLS, Vercel deployment, and GitHub source control.

## Users

Investors and research-oriented users evaluating Vietnamese listed equities. The exact retail/institutional priority remains open.

## Product Purpose

AI Stock Research turns Vietnamese company data and current web evidence into an inspectable stock-research dashboard.

## Positioning

The product combines Vietnam-specific market evidence with AI-assisted synthesis and keeps the underlying evidence visible rather than presenting unsupported recommendations.

## Operating Context

Users authenticate before entering the product, search a HOSE, HNX or UPCOM symbol, and inspect financial trends, technical evidence, cited web research, and AI-assisted decision signals.

## Capabilities and Constraints

- Public login route plus authenticated home, analysis, and discover routes.
- Supabase email/password and Google OAuth authentication with cookie-based SSR sessions.
- Supabase-backed stock catalog, OHLCV, fundamentals, watchlist, research history and short-lived AI report cache.
- Free VNStock community data is refreshed by GitHub Actions; availability and rate limits remain upstream constraints.
- Tavily and Gemini free tiers provide current cited research within their quotas.

## Brand Commitments

The product name is AI Stock Research. Use a clear, accessible white/slate interface with trust navy and unambiguous green/red/amber financial states.

## Evidence on Hand

The original Stitch screens informed the product structure. Placeholder-only routes were removed in favor of three working research surfaces.

## Product Principles

- Evidence remains inspectable alongside AI conclusions.
- Dense information must remain easy to scan.
- Financial states use consistent semantic color and tabular numerals.
- Public discovery is simple; authenticated research preserves context across routes.
