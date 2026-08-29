# Targeted refresh runtime

Phase D uses the existing GitHub Actions and Supabase credentials as a small, scheduled Python worker. It does not dispatch a workflow from Vercel and therefore does not add a GitHub token to the web application.

## Runtime decision

| Option | Decision | Reason |
| --- | --- | --- |
| Vercel request runs VNStock Python | Rejected | A user request must return quickly, while provider refreshes can take minutes and require the pinned Python environment. |
| Vercel dispatches GitHub Actions | Deferred | It reduces queue pickup latency but adds a server-only Actions token and still inherits GitHub queue delay. |
| Supabase Edge Function | Rejected for VNStock | The existing provider implementation and dependencies are Python-specific. |
| Scheduled GitHub worker reads Supabase queue | Selected | It reuses the current free runner and secrets, keeps Python out of the request path, and preserves database locking/retry state. |
| New public Node market endpoint | Deferred | No additional source has yet passed licensing, provenance, stability, and data-quality review. |

GitHub documents a five-minute minimum schedule interval and warns that scheduled runs may be delayed or dropped during high load. The implementation therefore advertises best-effort delayed data, not exchange realtime: <https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule>.

## Scheduling contract

- The worker runs at minutes 07, 22, 37, and 52 from 02:00 through 08:59 UTC on weekdays.
- Each run prepares all four deterministic symbol shards, but claims at most four jobs total.
- Hot symbols are eligible every 15 minutes. Warm symbols are eligible every 60 minutes. Cold symbols are refreshed only after user activity queues them.
- Hot inputs are current views, searches, watchlists, and the quantitative Top 5 in each sector.
- The partial unique index on active jobs remains the deduplication lock.
- A provider failure is completed through the Phase B retry function, which keeps cached data visible and applies exponential backoff.
