"""Claim and execute a small shard of durable refresh jobs."""

from __future__ import annotations

import os
import socket
import time
from datetime import date, timedelta
from typing import Any

try:
    from .disclosure_connectors import sync_disclosures
    from .sync_company_research import sync_fundamentals
    from .sync_market_data import SupabaseRest, configure_vnstock_api, sync_symbol
except ImportError:  # Support `python scripts/process_refresh_jobs.py`.
    from disclosure_connectors import sync_disclosures
    from sync_company_research import sync_fundamentals
    from sync_market_data import SupabaseRest, configure_vnstock_api, sync_symbol


def integer_env(name: str, default: int, minimum: int, maximum: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value < minimum or value > maximum:
        raise RuntimeError(f"{name} must be between {minimum} and {maximum}")
    return value


def stock_metadata(client: SupabaseRest, symbol: str) -> tuple[str, str, str]:
    rows = client.select(
        "stocks",
        "company_name,sector,exchange",
        symbol=f"eq.{symbol}",
        limit="1",
    )
    if not rows:
        raise RuntimeError("stock metadata is missing")
    row = rows[0]
    return str(row["company_name"]), str(row["sector"]), str(row["exchange"])


def execute_job(client: SupabaseRest, job: dict[str, Any]) -> None:
    symbol = str(job["symbol"])
    data_type = str(job["data_type"])
    if data_type == "market":
        lookback_days = integer_env("MARKET_LOOKBACK_DAYS", 240, 60, 730)
        end_date = date.today()
        sync_symbol(
            client,
            symbol,
            stock_metadata(client, symbol),
            (end_date - timedelta(days=lookback_days)).isoformat(),
            end_date.isoformat(),
            float(os.getenv("VNSTOCK_PRICE_MULTIPLIER", "1000")),
        )
        return
    if data_type == "fundamentals":
        sources = [
            item.strip().upper()
            for item in os.getenv("VNSTOCK_FINANCE_SOURCES", "VCI").split(",")
            if item.strip()
        ]
        sync_fundamentals(client, symbol, sources)
        return
    if data_type == "disclosures":
        _, _, exchange = stock_metadata(client, symbol)
        sync_disclosures(client, symbol, exchange)
        return
    raise RuntimeError(f"No worker is configured for data type: {data_type}")


def main() -> int:
    configure_vnstock_api()
    client = SupabaseRest()
    shard_count = integer_env("REFRESH_SHARD_COUNT", 4, 1, 16)
    shard = integer_env("REFRESH_SHARD", 0, 0, shard_count - 1)
    batch_size = integer_env("REFRESH_BATCH_SIZE", 4, 1, 12)
    worker_id = os.getenv("REFRESH_WORKER_ID") or f"github-{socket.gethostname()}-{os.getpid()}"

    all_shards = os.getenv("REFRESH_PREPARE_ALL_SHARDS", "").strip().lower() in {"1", "true", "yes"}
    shards = range(shard_count) if all_shards else (shard,)
    per_shard_limit = max(1, (batch_size + shard_count - 1) // shard_count) if all_shards else batch_size
    prepared = 0
    for current_shard in shards:
        prepared += int(client.rpc("prepare_scheduled_refresh_jobs", {
            "p_shard": current_shard,
            "p_shard_count": shard_count,
            "p_limit": per_shard_limit,
        }) or 0)
    jobs = client.rpc("claim_refresh_jobs", {
        "p_worker_id": worker_id,
        "p_limit": batch_size,
        "p_lock_timeout_seconds": 900,
    }) or []
    scope = "all shards" if all_shards else f"shard {shard}/{shard_count}"
    print(f"Prepared {prepared} scheduled jobs; claimed {len(jobs)} jobs for {scope}", flush=True)

    failures = 0
    delay = float(os.getenv("VNSTOCK_REQUEST_DELAY_SECONDS", "5"))
    for index, job in enumerate(jobs):
        try:
            execute_job(client, job)
            client.rpc("complete_refresh_job", {
                "p_job_id": job["id"],
                "p_worker_id": worker_id,
                "p_succeeded": True,
                "p_error": None,
            })
            print(f"Completed {job['data_type']} refresh for {job['symbol']}", flush=True)
        except Exception as error:
            failures += 1
            client.rpc("complete_refresh_job", {
                "p_job_id": job["id"],
                "p_worker_id": worker_id,
                "p_succeeded": False,
                "p_error": str(error),
            })
            print(f"Failed {job['data_type']} refresh for {job['symbol']}: {error}", flush=True)
        if index < len(jobs) - 1 and delay > 0:
            time.sleep(delay)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
