"""Evaluate matured AI scenarios against persisted EOD closes."""
from __future__ import annotations

import json
import os
from urllib.request import Request, urlopen


def evaluate() -> int:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    request = Request(
        f"{url}/rest/v1/rpc/evaluate_due_predictions",
        data=b"{}",
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    with urlopen(request, timeout=60) as response:
        return int(json.loads(response.read().decode("utf-8")) or 0)


def main() -> int:
    count = evaluate()
    print(f"Evaluated {count} matured prediction scenarios", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
