import os
import tempfile
import unittest
import json
from unittest.mock import patch
from pathlib import Path

os.environ.setdefault("CONTROL_PLANE_URL", "https://control.example.com")
os.environ.setdefault("PLATFORM_WORKER_TOKEN", "t" * 48)

import platform_worker as worker


class PlatformWorkerSecurityTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        manifest = Path(self.directory.name) / 'approved-releases.json'
        manifest.write_text(json.dumps({'v1.2.3': {'frontendImage': 'dental-erp-web:1.2.3', 'frontendImageId': 'sha256:' + 'a' * 64}}))
        self.manifest_patch = patch.object(worker, 'RELEASE_MANIFEST', manifest)
        self.manifest_patch.start()
        self.addCleanup(self.manifest_patch.stop)
        self.token_patch = patch.dict(os.environ, {'SAAS_READER_TOKEN': 'r' * 48})
        self.token_patch.start()
        self.addCleanup(self.token_patch.stop)

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

    def test_success_report_omits_null_error_and_version(self):
        with patch.object(worker, 'request') as request:
            worker.report('job-1', 'SUCCEEDED', result={'message': 'Backup completed'})
        payload = request.call_args.kwargs['payload']
        self.assertNotIn('error', payload)
        self.assertNotIn('version', payload)
        self.assertEqual(payload['status'], 'SUCCEEDED')

    def test_failure_report_preserves_error_without_null_version(self):
        with patch.object(worker, 'request') as request:
            worker.report('job-1', 'FAILED', error='Health check failed')
        payload = request.call_args.kwargs['payload']
        self.assertEqual(payload['error'], 'Health check failed')
        self.assertNotIn('version', payload)

    def test_unapproved_and_mutable_releases_are_rejected(self):
        for version in ['latest', 'v9.9.9', '1.2.3\nSAAS_ENFORCEMENT=disabled']:
            job = self.valid_job()
            job['installation']['version'] = version
            with self.assertRaises(worker.JobError):
                worker.validate_job(job)


if __name__ == "__main__":
    unittest.main()
