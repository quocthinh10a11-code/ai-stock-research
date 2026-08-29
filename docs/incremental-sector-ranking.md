# Incremental sector ranking

Phase G keeps deterministic ranking while separating quote cadence from fundamental cadence.

- Intraday runs fetch the price board only for the cached HOSE/HNX screener universe, update quote fields, and re-score the existing rows. They retain the last verified `financial_period` and financial metrics.
- Full runs refresh listings, ICB classification, liquidity, and candidates. Financial ratios are reused for seven days by default and refreshed periodically; if the provider fails, a previously verified financial period remains visible with `stale-fundamentals` quality instead of deleting the symbol.
- `SCREENER_FUNDAMENTAL_REFRESH_DAYS` controls the periodic check and defaults to 7. This is a best-effort free-source policy, not an exchange event feed.

Instrument classification happens before OHLCV and ratio calls. Explicit listing metadata, company names, and conservative Vietnam ETF symbol prefixes identify ETFs, funds, warrants, and bonds. They are not sent to expensive company-data endpoints.

Every full run records bounded exclusion provenance such as non-equity instrument, missing ICB mapping, missing quote, base-filter failure, missing OHLCV, or unavailable financial metrics. Discover shows aggregated reasons and example symbols. The exclusion table is public-read market metadata with RLS; only the service role can write it.

NPL and LLCR remain `null` unless a reliable source explicitly provides them. Phase G does not infer either metric.
