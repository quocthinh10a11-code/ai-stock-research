# Official disclosure connectors

The disclosure pipeline stores only metadata needed by the product: ticker, exchange, title, official URL, publication time, a short excerpt when the official API supplies one, fetch time, quality, and a SHA-256 content hash. It does not mirror full articles or attachment bodies.

## Coverage

- HNX and UPCoM: targeted fetch of the public issuer profile on `hnx.vn`; the connector parses only the `dTinCongBo` disclosure table and keeps its official detail links.
- HOSE: targeted filtering over the public news API used by `hsx.vn`. The connector scans the latest 100 official entries over seven days and marks the result `partial`, because the API does not expose a verified ticker-specific query contract.
- Company Investor Relations: still used by the existing Tavily discovery path when the user requests AI research. It is not batch-crawled because Vietnamese issuers do not share one verified feed contract; a company page is treated as official only when returned as a cited source.

The worker uses a descriptive user agent, HTTPS only, one targeted request per disclosure job, a 30-second timeout, and the existing queue backoff. A failed connector preserves earlier rows and records an error in `disclosure_sync_status`.

Official entry points verified during implementation:

- <https://www.hnx.vn/>
- <https://www.hsx.vn/vi/thong-tin-cong-bo>
- <https://api.hsx.vn/n/api/v1/1/news>
