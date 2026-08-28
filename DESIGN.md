# AI Stock Research Design System

## Product mode

Operate. The primary task is to search a Vietnamese listed company, verify the evidence, and understand an AI-assisted decision signal.

## Information architecture

- Home: focused ticker search and synchronized-market entry points.
- Discover: real synchronized rankings and watchlist actions.
- Analysis: company facts, financial trend, AI decision matrix, scenarios, and cited live sources.
- Technical, sentiment, model-portfolio, and overview placeholders are intentionally excluded until they have production data.

## Visual system

- Canvas: `#F8FAFC`; surfaces: `#FFFFFF`; borders: `#E2E8F0`.
- Primary: `#0F172A`; gain: `#16A34A`; loss: `#DC2626`; warning: `#D97706`.
- Inter is the interface font. JetBrains Mono is reserved for tickers and financial measurements.
- Cards use crisp borders, 8px radius, and a subtle `0 1px 3px rgba(15,23,42,.08)` shadow.
- No gradients, glass effects, decorative blur, or unsupported market claims.

## Interaction rules

- One persistent top navigation across authenticated routes.
- Search accepts HOSE, HNX, and UPCOM symbols from the synchronized catalog.
- Every AI recommendation exposes confidence, missing data, and source references.
- Green, red, and amber always mean positive, negative, and caution/insufficient evidence respectively.
- Mobile layouts preserve the same task order and expose every primary action without a hidden sidebar.
