# Market data sync

The scheduled job fetches daily OHLCV data from the Vnstock Community v4.0.7 Unified UI and stores it in Supabase. It currently covers VCB, SSI, HPG, FPT, VHM, VIC, VND, MWG, DGC, VPB, VNM, and MBB.

## Required secrets

- `SUPABASE_URL`: project URL.
- `SUPABASE_SECRET_KEY`: backend-only Supabase secret key. A legacy `SUPABASE_SERVICE_ROLE_KEY` also works for local execution.

Never expose either backend key through a `NEXT_PUBLIC_` variable. In GitHub, add the two values under repository Actions secrets. The EOD workflow runs at 17:47 ICT on weekdays, after the closing data has had time to settle, and can also be started manually. Scheduled EOD runs update market data only; a manual dispatch continues to update both market data and selected company fundamentals.

## Local run

```powershell
python -m pip install -r requirements-market-data.txt
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SECRET_KEY = "your-backend-secret"
python scripts/sync_market_data.py
```

Apply every SQL migration before the first run. Optional variables are `MARKET_SYMBOLS`, `MARKET_LOOKBACK_DAYS`, `VNSTOCK_REQUEST_DELAY_SECONDS`, and `VNSTOCK_PRICE_MULTIPLIER`.

Supabase writes retry transient TLS, connection, rate-limit, and 5xx failures up to four times with exponential backoff. Override this with `SUPABASE_HTTP_MAX_ATTEMPTS` and `SUPABASE_HTTP_RETRY_DELAY_SECONDS` when needed.

## Indicator and source limitations

The community package is an extraction tool over public broker endpoints, not an exchange data feed. Guest mode is limited to 20 requests per minute; the job therefore fetches symbols sequentially. Vnstock's package license is personal, research, and non-commercial, so obtain appropriate data rights before commercial production use.

SMA20/50, EMA20/50, RSI14, ATR14, Volume MA20, and Relative Volume are calculated locally. `agent_analysis` is a temporary deterministic rule: bullish when close > EMA20 > EMA50, bearish for the inverse, and neutral otherwise. It is explicitly not LLM synthesis or investment advice.
