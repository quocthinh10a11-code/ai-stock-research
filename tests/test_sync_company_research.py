import os
import unittest
from unittest.mock import MagicMock, patch

import pandas as pd

from scripts.sync_company_research import all_exchange_listings, kbs_report_frame, listing_rows, main, normalize_monetary_values, period_end_date, report_values, sync_fundamentals, validate_financial_periods, vci_report_frame


class CompanyListingTests(unittest.TestCase):
    def test_quarter_parser_does_not_treat_last_year_digit_as_quarter(self):
        self.assertEqual(period_end_date("2024-Q1"), "2024-03-31")
        self.assertEqual(period_end_date("2024-Q2"), "2024-06-30")
        self.assertEqual(period_end_date("2024-Q3"), "2024-09-30")
        self.assertEqual(period_end_date("2024-Q4"), "2024-12-31")
    def test_vci_history_requests_bounded_full_periods(self):
        finance = MagicMock()
        finance._provider._get_financial_report.return_value = pd.DataFrame({"item_id": ["net_sales"]})

        frame = vci_report_frame(finance, "income_statement")

        self.assertFalse(frame.empty)
        finance._provider._get_financial_report.assert_called_once_with(
            "income_statement", period="quarter", get_all=True, dropna=True, limit=40
        )
    def test_vnd_million_values_are_normalized_but_eps_is_not_scaled(self):
        values, unit = normalize_monetary_values({
            "2025-Q4": {"revenue": 3_830_762.0, "net_profit": 2_259_937.0, "eps": 1_234.0}
        }, "VND million")

        self.assertEqual(unit, "VND")
        self.assertEqual(values["2025-Q4"]["revenue"], 3_830_762_000_000.0)
        self.assertEqual(values["2025-Q4"]["net_profit"], 2_259_937_000_000.0)
        self.assertEqual(values["2025-Q4"]["eps"], 1_234.0)

    def test_impossible_balance_sheet_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "balance sheet identity mismatch"):
            validate_financial_periods([{
                "period_label": "2025-Q4", "period_end": "2025-12-31",
                "total_assets": 100_000_000.0, "total_liabilities": 20_000_000.0, "equity": 20_000_000.0,
            }])
    def test_kbs_duplicate_periods_keep_last_consolidated_value(self):
        finance = MagicMock()
        finance._provider._fetch_financial_data.return_value = {
            "Head": [
                {"YearPeriod": 2026, "TermCode": "Q2"},
                {"YearPeriod": 2026, "TermCode": "Q1"},
                {"YearPeriod": 2025, "TermCode": "Q4"},
                {"YearPeriod": 2025, "TermCode": "Q4"},
                {"YearPeriod": 2025, "TermCode": "Q4"},
                {"YearPeriod": 2025, "TermCode": "Q3"},
            ],
            "Content": {"Kết quả kinh doanh": [{
                "Name": "I. Thu nhập lãi thuần", "NameEn": "I. Net Interest Income",
                "Value1": 6_708_726, "Value2": 5_497_241, "Value3": 187_363,
                "Value4": 5_543_669, "Value5": 3_830_762, "Value6": 5_323_821,
            }]},
        }

        frame = kbs_report_frame(finance, "income_statement")
        periods, values, unit = report_values(frame)

        self.assertEqual(periods, ["2026-Q2", "2026-Q1", "2025-Q4", "2025-Q3"])
        self.assertEqual(values["2025-Q4"]["revenue"], 3_830_762_000.0)
        self.assertEqual(unit, "VND")

    def test_bank_profit_aliases_are_mapped_without_suffix_false_positives(self):
        frame = pd.DataFrame([
            {"item_id": "total_operating_income", "2025-Q4": 6_200.0},
            {"item_id": "net_profit_loss_after_tax", "2025-Q4": 2_259.0},
            {"item_id": "unrelated_operating_income_note", "2025-Q4": 99.0},
        ])

        _, values, _ = report_values(frame)

        self.assertEqual(values["2025-Q4"]["gross_profit"], 6_200.0)
        self.assertEqual(values["2025-Q4"]["net_profit"], 2_259.0)
        self.assertNotIn("operating_profit", values["2025-Q4"])

    def test_lower_priority_revenue_alias_cannot_overwrite_canonical_revenue(self):
        frame = pd.DataFrame([
            {"item_id": "revenue", "2025-Q4": 900.0},
            {"item_id": "operating_sales", "2025-Q4": -24.0},
        ])

        _, values, _ = report_values(frame)

        self.assertEqual(values["2025-Q4"]["revenue"], 900.0)

    def test_vci_net_sales_and_operating_sales_map_to_revenue(self):
        company = pd.DataFrame([{"item_id": "net_sales", "2025-Q4": 1_200.0}])
        securities = pd.DataFrame([{"item_id": "operating_sales", "2025-Q4": 800.0}])

        _, company_values, _ = report_values(company)
        _, securities_values, _ = report_values(securities)

        self.assertEqual(company_values["2025-Q4"]["revenue"], 1_200.0)
        self.assertEqual(securities_values["2025-Q4"]["revenue"], 800.0)

    def test_contradictory_negative_revenue_is_withheld_instead_of_presented_as_total(self):
        rows = [{
            "period_label": "2025-Q4", "period_end": "2025-12-31",
            "revenue": -24_000_000_000.0,
            "gross_profit": 705_000_000_000.0,
            "net_profit": 308_000_000_000.0,
        }]

        quality = validate_financial_periods(rows)

        self.assertIsNone(rows[0]["revenue"])
        self.assertEqual(quality, "partial")

    def test_bank_total_operating_income_is_derived_from_report_lines(self):
        frame = pd.DataFrame([
            {"item_id": "VIII. Operating expenses", "2025-Q4": 2_107_960.0},
            {"item_id": "IX. Operating profit before provision for credit losses", "2025-Q4": 3_685_231.0},
            {"item_id": "XIII. Net profit after tax", "2025-Q4": 2_259_937.0},
        ])

        _, values, _ = report_values(frame)

        self.assertEqual(values["2025-Q4"]["gross_profit"], 5_793_191.0)
        self.assertEqual(values["2025-Q4"]["net_profit"], 2_259_937.0)

    def test_combines_exchange_payloads_when_provider_omits_exchange_column(self):
        listing = MagicMock()
        listing.symbols_by_exchange.side_effect = [
            pd.DataFrame([{"symbol": "FPT", "organ_name": "FPT Corporation"}]),
            pd.DataFrame([{"symbol": "ACB", "organ_name": "Asia Commercial Bank"}]),
            pd.DataFrame([{"symbol": "VGI", "organ_name": "Viettel Global"}]),
        ]

        rows = listing_rows(all_exchange_listings(listing))

        self.assertEqual([(row["symbol"], row["exchange"]) for row in rows], [
            ("FPT", "HOSE"), ("ACB", "HNX"), ("VGI", "UPCOM"),
        ])

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

    @patch.dict(os.environ, {
        "FUNDAMENTAL_SYMBOLS": "FPT",
        "VNSTOCK_INITIAL_DELAY_SECONDS": "0",
    }, clear=False)
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
        mocked_listing.return_value.symbols_by_exchange.side_effect = [frame, pd.DataFrame(), pd.DataFrame()]
        client = MagicMock()
        mocked_rest.return_value = client

        result = main()

        self.assertEqual(result, 0)
        self.assertEqual(mocked_listing.return_value.symbols_by_exchange.call_count, 3)
        mocked_sync_fundamentals.assert_called_once_with(client, "FPT", ["KBS", "VCI"])
        client.upsert.assert_called_once()

    @patch.dict(os.environ, {"VNSTOCK_FINANCE_REQUEST_DELAY_SECONDS": "0"}, clear=False)
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
        fallback_provider._provider = None
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
        self.assertEqual(rows[0]["source_name"], "vnstock-community/vci")
        self.assertEqual(rows[0]["data_quality"], "partial")
        self.assertEqual(rows[0]["refresh_status"], "ready")
        self.assertIn("fetched_at", rows[0])
        self.assertIn("expires_at", rows[0])
        self.assertEqual(rows[0]["revenue"], 10_000_000.0)
        self.assertIsNone(rows[0]["net_profit"])
        self.assertEqual(rows[0]["unit"], "VND")
        self.assertEqual(len(rows[0]["content_hash"]), 64)


if __name__ == "__main__":
    unittest.main()
