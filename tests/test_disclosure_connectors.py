import json
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from scripts.disclosure_connectors import hnx_disclosures, hose_disclosures, sync_disclosures


FIXTURES = Path(__file__).parent / "fixtures"


class RecordingClient:
    def __init__(self):
        self.calls = []

    def upsert(self, table, rows, conflict):
        self.calls.append((table, rows, conflict))


class OfficialDisclosureConnectorTests(unittest.TestCase):
    @patch("scripts.disclosure_connectors.fetch_text")
    def test_parses_only_the_hnx_official_disclosure_table(self, fetch):
        fetch.return_value = (FIXTURES / "hnx_disclosures.html").read_text(encoding="utf-8")

        rows = hnx_disclosures("MBS", "HNX", datetime(2026, 8, 29, tzinfo=timezone.utc))

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["symbol"], "MBS")
        self.assertEqual(rows[0]["source_name"], "HNX Official")
        self.assertTrue(rows[0]["source_url"].startswith("https://www.hnx.vn/"))
        self.assertRegex(rows[0]["content_hash"], r"^[a-f0-9]{64}$")

    @patch("scripts.disclosure_connectors.fetch_text")
    def test_hose_feed_filters_by_ticker_and_keeps_only_an_excerpt(self, fetch):
        fetch.return_value = (FIXTURES / "hose_disclosures.json").read_text(encoding="utf-8")

        rows = hose_disclosures("FPT", datetime(2026, 8, 29, tzinfo=timezone.utc))

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["title"], "FPT: Công bố kết quả kinh doanh quý 2/2026")
        self.assertNotIn("<p>", rows[0]["excerpt"])
        self.assertEqual(rows[0]["data_quality"], "partial")

    @patch("scripts.disclosure_connectors.hnx_disclosures", return_value=[])
    def test_records_successful_empty_observation_without_inventing_news(self, _connector):
        client = RecordingClient()

        count = sync_disclosures(client, "MBS", "HNX")

        self.assertEqual(count, 0)
        self.assertEqual(client.calls[0], ("official_disclosures", [], "source_url"))
        status = client.calls[1][1][0]
        self.assertIsNone(status["provider_timestamp"])
        self.assertEqual(status["refresh_status"], "ready")


if __name__ == "__main__":
    unittest.main()
