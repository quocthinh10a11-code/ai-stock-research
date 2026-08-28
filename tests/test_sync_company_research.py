import os
import unittest
from unittest.mock import MagicMock, patch

import pandas as pd

from scripts.sync_company_research import listing_rows, main


class CompanyListingTests(unittest.TestCase):
    def test_accepts_kbs_exchange_payload_and_filters_non_stocks(self):
        frame = pd.DataFrame([
            {
                "symbol": "FPT",
                "organ_name": "FPT Corporation",
                "exchange": "HOSE",
                "type": "stock",
            },
            {
                "symbol": "VGI",
                "organ_name": "Viettel Global",
                "exchange": "UPCOM",
                "type": "stock",
            },
            {
                "symbol": "E1VFVN30",
                "organ_name": "VN30 ETF",
                "exchange": "HOSE",
                "type": "etf",
            },
        ])

        rows = listing_rows(frame)

        self.assertEqual([row["symbol"] for row in rows], ["FPT", "VGI"])
        self.assertEqual(rows[0]["exchange"], "HOSE")
        self.assertEqual(rows[1]["exchange"], "UPCOM")

    @patch.dict(os.environ, {"FUNDAMENTAL_SYMBOLS": "NOTLISTED"}, clear=False)
    @patch("scripts.sync_company_research.Listing")
    @patch("scripts.sync_company_research.SupabaseRest")
    def test_main_requests_exchange_listing(self, mocked_rest, mocked_listing):
        frame = pd.DataFrame([
            {
                "symbol": "FPT",
                "organ_name": "FPT Corporation",
                "exchange": "HOSE",
                "type": "stock",
            }
        ])
        mocked_listing.return_value.symbols_by_exchange.return_value = frame
        client = MagicMock()
        mocked_rest.return_value = client

        result = main()

        self.assertEqual(result, 0)
        mocked_listing.return_value.symbols_by_exchange.assert_called_once_with()
        mocked_listing.return_value.all_symbols.assert_not_called()
        client.upsert.assert_called_once()


if __name__ == "__main__":
    unittest.main()
