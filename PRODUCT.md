# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 15 App Router, TypeScript, Tailwind CSS, Supabase Auth and PostgreSQL with RLS, Vercel deployment, and GitHub source control.

## Users

Investors and research-oriented users evaluating Vietnamese listed equities. The exact retail/institutional priority remains open.

## Product Purpose

AI Stock Research brings market overview, technical rankings, sentiment, stock analysis, and model portfolios into one research workspace for the Vietnamese stock market.

## Positioning

The product combines Vietnam-specific market evidence with AI-assisted synthesis and keeps the underlying evidence visible rather than presenting unsupported recommendations.

## Operating Context

Users authenticate before entering the product, then search stock symbols from a focused home page, scan market breadth and rankings, inspect AI insights and sentiment, and compare model portfolio allocations in a dense research workflow.

## Capabilities and Constraints

- Public login route plus authenticated home, analysis, discover, technical, sentiment, and portfolio routes.
- Supabase email/password and Google OAuth authentication with cookie-based SSR sessions.
- Mock typed data and replaceable async data functions until the production PostgreSQL schema is supplied.
- The supplied Stitch screens are the visual and content authority.
- Production database schema, real market data provider, refresh cadence, and RLS policies remain open.

## Brand Commitments

The product name is AI Stock Research. Preserve the supplied Stitch design language: precise, dense, technical, restrained, and optimized for financial scanning.

## Evidence on Hand

Seven supplied Stitch screens cover Login, Landing, Overview, Discover, Technical, Sentiment, and Model Portfolios. No real financial claims, customer proof, or production datasets have been supplied; displayed values are synthetic mock data.

## Product Principles

- Evidence remains inspectable alongside AI conclusions.
- Dense information must remain easy to scan.
- Financial states use consistent semantic color and tabular numerals.
- Public discovery is simple; authenticated research preserves context across routes.
