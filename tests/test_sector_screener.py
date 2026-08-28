import unittest

from scripts.sync_sector_screener import GROUP_BY_CODE, TAXONOMY, score_row


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


if __name__ == "__main__":
    unittest.main()
