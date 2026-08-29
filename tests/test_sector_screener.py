import unittest

from datetime import datetime, timezone

from scripts.sync_sector_screener import GROUP_BY_CODE, TAXONOMY, build_intraday_row, classify_instrument, reusable_fundamentals, score_row


class SectorScreenerTests(unittest.TestCase):
    def test_taxonomy_has_ten_groups_and_nineteen_icb_level_two_codes(self):
        self.assertEqual(len(TAXONOMY), 10)
        self.assertEqual(len(GROUP_BY_CODE), 19)

    def test_strong_company_passes_common_screener(self):
        row = score_row({
            "sector_group": "Công nghệ thông tin",
            "industry": "Công nghệ Thông tin",
            "market_cap": 50_000_000_000_000,
            "average_volume20": 2_000_000,
            "price": 50_000,
            "exchange": "HOSE",
            "trading_status": "TRADING_ACTIVATED",
            "security_status": "N",
            "profit_growth": 20,
            "revenue_growth": 15,
            "debt_to_equity": 0.5,
            "roe": 22,
            "gross_margin": 30,
            "pe": 12,
        })
        self.assertTrue(row["eligible"])
        self.assertGreaterEqual(row["score"], 80)

    def test_missing_financial_data_is_not_marked_as_passed(self):
        row = score_row({
            "sector_group": "Tài chính",
            "industry": "Ngân hàng",
            "market_cap": 50_000_000_000_000,
            "average_volume20": 2_000_000,
            "price": 50_000,
            "exchange": "HOSE",
            "trading_status": "TRADING_ACTIVATED",
            "security_status": "N",
            "profit_growth": None,
            "revenue_growth": None,
            "debt_to_equity": None,
            "roe": None,
            "gross_margin": None,
            "pe": None,
            "nim": None,
            "npl": None,
            "llcr": None,
        })
        self.assertFalse(row["eligible"])
        unavailable = [item for item in row["criteria_json"] if item["passed"] is None]
        self.assertGreater(len(unavailable), 0)

    def test_etf_is_classified_before_expensive_company_requests(self):
        self.assertEqual(classify_instrument({"symbol": "FUEVFVND", "organ_name": "DCVFM VN DIAMOND ETF"}, "organ_name"), "etf")
        self.assertEqual(classify_instrument({"symbol": "FPT", "organ_name": "FPT Corporation"}, "organ_name"), "equity")

    def test_intraday_refresh_changes_quote_but_keeps_fundamentals(self):
        cached = {
            "id": 7, "company_name": "Example", "symbol": "AAA", "sector_group": "Công nghiệp", "industry": "Sản xuất",
            "exchange": "HOSE", "price": 20_000, "change_pct": 0, "market_cap": 2_000_000_000_000,
            "average_volume20": 500_000, "financial_period": "2026-Q2", "pe": 10, "roe": 20,
            "profit_growth": 15, "revenue_growth": 12, "debt_to_equity": 0.5, "gross_margin": 25,
            "trading_status": "TRADING_ACTIVATED", "security_status": "N", "inventory_turnover": None,
            "dividend_yield": None,
        }
        refreshed = build_intraday_row(cached, {"price": 21_000, "change_pct": 5, "market_cap": 2_100_000_000_000, "trading_status": "TRADING_ACTIVATED", "security_status": "N"}, "2026-08-29T03:00:00+00:00", "2026-08-29T03:30:00+00:00")
        self.assertEqual(refreshed["price"], 21_000)
        self.assertEqual(refreshed["pe"], 10)
        self.assertEqual(refreshed["financial_period"], "2026-Q2")
        self.assertNotIn("company_name", refreshed)

    def test_fundamentals_are_reused_within_the_periodic_refresh_window(self):
        cached = {"financial_period": "2026-Q2", "fundamentals_fetched_at": "2026-08-27T00:00:00+00:00", "pe": 12}
        reused = reusable_fundamentals(cached, datetime(2026, 8, 29, tzinfo=timezone.utc), 7)
        expired = reusable_fundamentals(cached, datetime(2026, 9, 10, tzinfo=timezone.utc), 7)
        self.assertEqual(reused["pe"], 12)
        self.assertIsNone(expired)


if __name__ == "__main__":
    unittest.main()
