import io
import os
import unittest
from datetime import date, timedelta
from http.client import RemoteDisconnected
from unittest.mock import call, patch
from urllib.error import HTTPError, URLError

import pandas as pd

from scripts.sync_market_data import SupabaseRest, sync_symbol


class SuccessfulResponse:
    status = 201

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


class JsonResponse(SuccessfulResponse):
    status = 200

    def read(self):
        return b'[{"symbol":"MBS"},{"symbol":"MBS"},{"symbol":"VGI"}]'


class SupabaseRestRetryTests(unittest.TestCase):
    @patch.dict(os.environ, {
        "SUPABASE_URL": "https://example.supabase.co",
        "SUPABASE_SECRET_KEY": "test-secret",
    }, clear=False)
    @patch("scripts.sync_market_data.urlopen", return_value=JsonResponse())
    def test_reads_unique_recent_research_symbols(self, _mocked_urlopen):
        self.assertEqual(SupabaseRest().recent_research_symbols(), ["MBS", "VGI"])

    @patch.dict(os.environ, {
        "SUPABASE_URL": "https://example.supabase.co",
        "SUPABASE_SECRET_KEY": "test-secret",
        "SUPABASE_HTTP_MAX_ATTEMPTS": "4",
        "SUPABASE_HTTP_RETRY_DELAY_SECONDS": "0.01",
    }, clear=False)
    @patch("scripts.sync_market_data.time.sleep")
    @patch("scripts.sync_market_data.urlopen")
    def test_retries_transient_connection_errors(self, mocked_urlopen, mocked_sleep):
        mocked_urlopen.side_effect = [
            URLError("TLS handshake timed out"),
            RemoteDisconnected("remote closed connection"),
            SuccessfulResponse(),
        ]

        SupabaseRest().upsert("stocks", [{"symbol": "VIC"}], "symbol")

        self.assertEqual(mocked_urlopen.call_count, 3)
        mocked_sleep.assert_has_calls([call(0.01), call(0.02)])

    @patch.dict(os.environ, {
        "SUPABASE_URL": "https://example.supabase.co",
        "SUPABASE_SECRET_KEY": "test-secret",
    }, clear=False)
    @patch("scripts.sync_market_data.urlopen")
    def test_does_not_retry_non_transient_http_errors(self, mocked_urlopen):
        mocked_urlopen.side_effect = HTTPError("https://example.supabase.co", 400, "Bad Request", {}, io.BytesIO(b"invalid row"))

        with self.assertRaisesRegex(RuntimeError, "HTTP 400 invalid row"):
            SupabaseRest().upsert("stocks", [{"symbol": "BAD"}], "symbol")

        self.assertEqual(mocked_urlopen.call_count, 1)


class AggregateSnapshotTests(unittest.TestCase):
    @patch("scripts.sync_market_data.fetch_ohlcv")
    def test_emits_one_aggregate_row_after_detail_rows(self, mocked_fetch):
        start = date(2026, 6, 1)
        mocked_fetch.return_value = pd.DataFrame([
            {
                "date": start + timedelta(days=index),
                "open": 100 + index,
                "high": 102 + index,
                "low": 99 + index,
                "close": 101 + index,
                "volume": 500_000 + index,
                "sma20": 98 + index,
                "sma50": 95 + index,
                "ema20": 99 + index,
                "ema50": 96 + index,
                "rsi14": 55,
                "atr14": 2,
                "volume_ma20": 450_000,
                "relative_volume": 1.1,
            }
            for index in range(50)
        ])

        class RecordingClient:
            def __init__(self):
                self.calls = []

            def upsert(self, table, rows, conflict):
                self.calls.append((table, rows, conflict))

        client = RecordingClient()
        sync_symbol(client, "FPT", ("FPT Corporation", "Technology", "HOSE"), "2026-06-01", "2026-08-29", 1000)

        table, rows, conflict = client.calls[-1]
        self.assertEqual(table, "current_market_snapshots")
        self.assertEqual(conflict, "symbol")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["symbol"], "FPT")
        self.assertEqual(rows[0]["previous_close"], 149)
        self.assertEqual(rows[0]["price_refresh_status"], "ready")


if __name__ == "__main__":
    unittest.main()
