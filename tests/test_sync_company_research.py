import os
import unittest
from unittest.mock import MagicMock, patch

import pandas as pd

from scripts.sync_company_research import listing_rows, main, sync_fundamentals


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

    @patch.dict(os.environ, {"FUNDAMENTAL_SYMBOLS": "FPT"}, clear=False)
    @patch("scripts.sync_company_research.sync_fundamentals", return_value=(1, "KBS"))
    @patch("scripts.sync_company_research.Listing")
    @patch("scripts.sync_company_research.SupabaseRest")
    def test_main_requests_exchange_listing(
        self, mocked_rest, mocked_listing, mocked_sync_fundamentals
    ):
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
        mocked_sync_fundamentals.assert_called_once_with(client, "FPT", ["KBS", "VCI"])
        client.upsert.assert_called_once()

    @patch("scripts.sync_company_research.report_values")
    @patch("scripts.sync_company_research.Finance")
    def test_fundamentals_fall_back_when_primary_provider_is_empty(
        self, mocked_finance, mocked_report_values
    ):
        empty_provider = MagicMock()
        empty_provider.income_statement.return_value = pd.DataFrame()
        empty_provider.balance_sheet.return_value = pd.DataFrame()
        empty_provider.cash_flow.return_value = pd.DataFrame()
        fallback_provider = MagicMock()
        fallback_provider.income_statement.return_value = pd.DataFrame({"item_id": ["revenue"]})
        fallback_provider.balance_sheet.return_value = pd.DataFrame({"item_id": ["total_assets"]})
        fallback_provider.cash_flow.return_value = pd.DataFrame({"item_id": ["net_cash_flow"]})
        mocked_finance.side_effect = [empty_provider, fallback_provider]
        mocked_report_values.side_effect = [
            (["2026-Q2"], {"2026-Q2": {"revenue": 10.0}}, "VND million"),
            (["2026-Q2"], {"2026-Q2": {"total_assets": 20.0}}, "VND million"),
            (["2026-Q2"], {"2026-Q2": {"operating_cash_flow": 5.0}}, "VND million"),
        ]
        client = MagicMock()

        count, source = sync_fundamentals(client, "FPT", ["KBS", "VCI"])

        self.assertEqual((count, source), (1, "VCI"))
        rows = client.upsert.call_args.args[1]
        self.assertEqual(rows[0]["source"], "vnstock-community/vci")
        self.assertEqual(rows[0]["revenue"], 10.0)


if __name__ == "__main__":
    unittest.main()
