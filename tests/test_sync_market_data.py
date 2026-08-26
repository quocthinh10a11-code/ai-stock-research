import io
import os
import unittest
from http.client import RemoteDisconnected
from unittest.mock import call, patch
from urllib.error import HTTPError, URLError

from scripts.sync_market_data import SupabaseRest


class SuccessfulResponse:
    status = 201

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


class SupabaseRestRetryTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
