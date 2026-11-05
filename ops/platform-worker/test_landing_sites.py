import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import subprocess
import landing_sites as ls


class LandingSiteTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        root = Path(self.dir.name)
        registry = root / 'sites.json'
        self.target = {'slug': 'demo-clinic', 'hostname': 'demo.example.com'}
        registry.write_text(json.dumps({'install-a': self.target}))
        registry.chmod(0o600)
        self.sites = root / 'caddy'
        for p in (
            patch.object(ls, 'REGISTRY', registry),
            patch.object(ls, 'CADDY_SITES', self.sites),
        ):
            p.start()
            self.addCleanup(p.stop)

    def job(self, action='SITE_SUSPEND', **fields):
        fields.setdefault('reason', 'Unpaid invoice')
        if action == 'SITE_STATUS':
            fields.pop('reason')
        return {
            'id': 'job-a',
            'action': action,
            'installation': {'id': 'install-a', 'hostname': 'demo.example.com', 'productKey': 'landing-site'},
            'request': {'action': action, **fields},
        }

    def test_binds_to_registry_entry(self):
        self.assertEqual(ls.validate(self.job())['siteTarget']['slug'], 'demo-clinic')

    def test_rejects_other_site_other_host_other_product_and_extra_fields(self):
        for key, value in [('id', 'install-b'), ('hostname', 'evil.example.com'), ('productKey', 'dental-erp')]:
            job = self.job()
            job['installation'][key] = value
            with self.assertRaises(ls.LandingSiteError):
                ls.validate(job)
        with self.assertRaises(ls.LandingSiteError):
            ls.validate(self.job(path='/etc'))

    def test_reason_required_for_suspend_but_not_status(self):
        with self.assertRaises(ls.LandingSiteError):
            ls.validate(self.job(reason='x'))
        self.assertEqual(ls.validate(self.job('SITE_STATUS'))['action'], 'SITE_STATUS')

    def test_suspend_then_restore_swaps_snippet(self):
        with patch.object(ls, 'run') as run:
            job = ls.validate(self.job())
            self.assertFalse(ls.execute({**job, 'action': 'SITE_STATUS'})['sitePaused'])
            self.assertTrue(ls.execute(job)['sitePaused'])
            self.assertIn('/_paused', (self.sites / 'demo-clinic.caddy').read_text())
            restore = ls.validate(self.job('SITE_RESTORE'))
            self.assertFalse(ls.execute(restore)['sitePaused'])
            self.assertIn('/demo-clinic/current', (self.sites / 'demo-clinic.caddy').read_text())
            self.assertEqual(run.call_count, 4)  # validate + reload, twice

    def test_failed_reload_restores_previous_snippet(self):
        self.sites.mkdir()
        path = self.sites / 'demo-clinic.caddy'
        path.write_text('previous')
        with patch.object(ls, 'run', side_effect=subprocess.CalledProcessError(1, 'caddy')):
            with self.assertRaises(ls.LandingSiteError):
                ls.execute(ls.validate(self.job()))
        self.assertEqual(path.read_text(), 'previous')


if __name__ == '__main__':
    unittest.main()
