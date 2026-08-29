# Freshness contract

Phase A makes cache age and provenance explicit without changing the current providers or starting background refresh jobs.

| Data type | Current fetch mode | TTL written by the pipeline | UI status before expiry | Provider timestamp |
| --- | --- | --- | --- | --- |
| Daily OHLCV | Scheduled VNStock batch | 36 hours | `EOD` | Trading date at the Vietnam market close |
| Technical evidence | Recomputed with daily OHLCV | 36 hours | `EOD` | Latest input trading date |
| Quarterly fundamentals | Scheduled/on-demand VNStock batch | 7 days | `Cached` | Financial period end |
| Sector ranking | Full or intraday screener | 30 minutes | `Delayed` | Screener observation time |
| Company AI research | Tavily + Gemini, with legacy fallback | 15 minutes | `Cached` | Synthesis time |
| Sector AI brief | Tavily + Gemini | 30 minutes | `Cached` | Synthesis time |

An expired record or a record carrying a provider error is always shown as `Stale`. `Live` is reserved for a future source contract that supplies an actual live quote; Phase A never labels current VNStock batch data live.

The shared metadata fields are `provider_timestamp`, `fetched_at`, `expires_at`, `source_name`, `source_url`, `data_quality`, `content_hash`, `last_error`, and `refresh_status`. `content_hash` is nullable until Phase F introduces input-hash caching. Historical OHLCV and financial periods remain intact.

Market open/closed is a best-effort Vietnam weekday/session indicator. It does not claim to know exchange holidays.
