import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("CONTROL_PLANE_URL", "https://control.example.com")
os.environ.setdefault("PLATFORM_WORKER_TOKEN", "t" * 48)

import platform_worker as worker


class PlatformWorkerSecurityTests(unittest.TestCase):
    def valid_job(self):
        return {
            "id": "job-1",
            "action": "PROVISION",
            "installation": {
                "slug": "abeba-dental",
                "hostname": "abeba.example.com",
                "composeProject": "client-abeba-dental",
                "version": "v1.2.3",
                "productKey": "dental-erp",
                "features": {"handwrittenDiagnosis": True},
            },
        }

    def test_validates_and_constructs_managed_path(self):
        job = worker.validate_job(self.valid_job())
        self.assertEqual(job["installation"]["root"], worker.CLIENT_ROOT / "abeba-dental")

    def test_rejects_path_escape_and_unknown_action(self):
        for slug in ("../root", "/opt/clinic", "UPPER"):
            job = self.valid_job()
            job["installation"]["slug"] = slug
            with self.assertRaises(worker.JobError):
                worker.validate_job(job)
        job = self.valid_job()
        job["action"] = "SHELL"
        with self.assertRaises(worker.JobError):
            worker.validate_job(job)

        job = self.valid_job()
        job["installation"]["version"] = ""
        with self.assertRaises(worker.JobError):
            worker.validate_job(job)

    def test_entitlement_becomes_instance_environment_only(self):
        job = worker.validate_job(self.valid_job())
        env = worker.env_text(job["installation"])
        self.assertIn("FEATURE_HANDWRITTEN_DIAGNOSIS=true", env)
        self.assertIn("COMPOSE_PROJECT_NAME=client-abeba-dental", env)
        self.assertNotIn("Sunny Smile", env)


if __name__ == "__main__":
    unittest.main()
