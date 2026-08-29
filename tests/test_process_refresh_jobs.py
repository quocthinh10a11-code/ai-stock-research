import os
import unittest
from unittest.mock import patch

from scripts import process_refresh_jobs


class FakeClient:
    def __init__(self, jobs=None):
        self.jobs = jobs or []
        self.calls = []

    def rpc(self, name, payload):
        self.calls.append((name, payload))
        if name == "prepare_scheduled_refresh_jobs":
            return 1
        if name == "claim_refresh_jobs":
            return self.jobs
        return payload


class RefreshWorkerTests(unittest.TestCase):
    @patch.dict(os.environ, {
        "REFRESH_SHARD": "0",
        "REFRESH_SHARD_COUNT": "4",
        "REFRESH_BATCH_SIZE": "4",
        "REFRESH_PREPARE_ALL_SHARDS": "true",
        "REFRESH_WORKER_ID": "test-worker",
        "VNSTOCK_REQUEST_DELAY_SECONDS": "0",
    }, clear=False)
    @patch("scripts.process_refresh_jobs.configure_vnstock_api")
    @patch("scripts.process_refresh_jobs.SupabaseRest")
    def test_prepares_each_shard_but_claims_one_bounded_batch(self, client_factory, _configure):
        client = FakeClient()
        client_factory.return_value = client

        self.assertEqual(process_refresh_jobs.main(), 0)

        prepare_calls = [call for call in client.calls if call[0] == "prepare_scheduled_refresh_jobs"]
        claim_calls = [call for call in client.calls if call[0] == "claim_refresh_jobs"]
        self.assertEqual([call[1]["p_shard"] for call in prepare_calls], [0, 1, 2, 3])
        self.assertEqual([call[1]["p_limit"] for call in prepare_calls], [1, 1, 1, 1])
        self.assertEqual(claim_calls[0][1]["p_limit"], 4)

    @patch.dict(os.environ, {
        "REFRESH_SHARD": "0",
        "REFRESH_SHARD_COUNT": "4",
        "REFRESH_BATCH_SIZE": "1",
        "REFRESH_PREPARE_ALL_SHARDS": "false",
        "REFRESH_WORKER_ID": "test-worker",
        "VNSTOCK_REQUEST_DELAY_SECONDS": "0",
    }, clear=False)
    @patch("scripts.process_refresh_jobs.execute_job", side_effect=RuntimeError("provider unavailable"))
    @patch("scripts.process_refresh_jobs.configure_vnstock_api")
    @patch("scripts.process_refresh_jobs.SupabaseRest")
    def test_returns_job_to_retry_state_after_provider_failure(self, client_factory, _configure, _execute):
        client = FakeClient([{"id": 42, "symbol": "FPT", "data_type": "market"}])
        client_factory.return_value = client

        self.assertEqual(process_refresh_jobs.main(), 1)

        completion = next(call for call in client.calls if call[0] == "complete_refresh_job")
        self.assertEqual(completion[1]["p_job_id"], 42)
        self.assertEqual(completion[1]["p_succeeded"], False)
        self.assertIn("provider unavailable", completion[1]["p_error"])


if __name__ == "__main__":
    unittest.main()
