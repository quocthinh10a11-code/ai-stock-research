# Refresh job contract

Phase B adds durable orchestration without choosing or deploying a long-running VNStock worker.

## Request path

1. Search resolves the symbol from the catalog and returns the cached result.
2. The server compares market and fundamentals expiry timestamps.
3. Missing or stale data is enqueued with `enqueue_refresh_jobs` using the server-only Supabase secret key.
4. The HTTP request returns without waiting for VNStock or a worker.
5. Repeated requests for the same active `symbol + data_type` return the existing job.

Authenticated callers may explicitly request `market`, `fundamentals`, or `disclosures` through `POST /api/refresh/[symbol]`. Browser roles cannot read or mutate `refresh_jobs` and cannot execute queue functions directly.

## Worker protocol

- `claim_refresh_jobs(worker_id, limit, lock_timeout_seconds)` atomically claims available rows with `FOR UPDATE SKIP LOCKED`.
- A stale running lock can be reclaimed after the supplied timeout.
- `complete_refresh_job(..., true)` marks the job succeeded.
- `complete_refresh_job(..., false, error)` retries after 30, 60, then 120 seconds across four attempts by default. The delay is capped at one hour when `max_attempts` is configured higher, and the row becomes failed after its final attempt.
- Provider work must happen outside the database transaction. Workers claim, perform I/O, then complete the job.

## Production worker decision remains open

| Option | Benefit | Constraint |
| --- | --- | --- |
| GitHub workflow dispatch per symbol | Reuses the existing Python pipeline | Requires a narrowly scoped Actions token in Vercel and has dispatch latency |
| Scheduled worker polling this queue | No user request waits for Python | Refresh delay follows the schedule; needs a durable runner |
| Node-compatible market endpoint | Can run close to the Next.js request path | Requires a source with verified terms, coverage and quota |
| Free external worker | Can poll frequently | Free-tier sleep, quota and operational reliability must be measured |

Phase B intentionally selects none of these. Phase D will choose the execution runtime after latency, provider terms and quota are verified.
