import unittest
from pathlib import Path


WORKFLOWS = Path(__file__).parents[1] / ".github" / "workflows"


class WorkflowScheduleTests(unittest.TestCase):
    def workflow(self, name: str) -> str:
        return (WORKFLOWS / name).read_text(encoding="utf-8")

    def test_intraday_jobs_skip_the_exchange_lunch_break(self):
        self.assertIn('cron: "7,22,37,52 2-4,6-8 * * 1-5"', self.workflow("process-refresh-queue.yml"))
        self.assertIn('cron: "13,43 2-4,6-8 * * 1-5"', self.workflow("sync-sector-screener.yml"))

    def test_eod_jobs_are_staggered(self):
        self.assertIn('cron: "47 10 * * 1-5"', self.workflow("sync-market-data.yml"))
        self.assertIn('cron: "37 11 * * 1-5"', self.workflow("sync-sector-screener.yml"))
        financials = self.workflow("sync-company-financials.yml")
        self.assertIn('cron: "17 13 * * 1-5"', financials)
        self.assertIn('cron: "17 1 * * 6"', financials)

    def test_every_fundamental_worker_prefers_consolidated_kbs_data(self):
        for name in ("process-refresh-queue.yml", "sync-market-data.yml", "sync-company-financials.yml"):
            self.assertIn("VNSTOCK_FINANCE_SOURCES: KBS,VCI", self.workflow(name), name)


if __name__ == "__main__":
    unittest.main()
