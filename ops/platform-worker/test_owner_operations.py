import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import subprocess
import owner_operations as ops

class OwnerOperationTests(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory();self.addCleanup(self.directory.cleanup)
        path=Path(self.directory.name)/'targets.json'
        self.target={'hostname':'clinic.example.com','productKey':'dental-erp','tenantId':'clinic-a','appContainer':'client-a-app-1','databaseContainer':'client-a-mysql-1'}
        path.write_text(json.dumps({'install-a':self.target}));path.chmod(0o600)
        self.registry=patch.object(ops,'REGISTRY',path);self.registry.start();self.addCleanup(self.registry.stop)
    def job(self,action='STATUS',**fields):
        return {'id':'job-a','action':action,'installation':{'id':'install-a','hostname':'clinic.example.com','productKey':'dental-erp'},'request':{'action':action,**fields}}
    def test_status_binding(self):
        self.assertEqual(ops.validate(self.job())['ownerTarget']['tenantId'],'clinic-a')
    def test_cannot_select_another_clinic_or_container(self):
        for key,value in [('id','install-b'),('hostname','other.example.com'),('productKey','clinic-cms')]:
            job=self.job();job['installation'][key]=value
            with self.assertRaises(ops.OwnerOperationError):ops.validate(job)
        with self.assertRaises(ops.OwnerOperationError):ops.validate(self.job(container='product-control-mysql'))
    def test_stop_requires_exact_hostname_and_reason(self):
        with self.assertRaises(ops.OwnerOperationError):ops.validate(self.job('DB_STOP',reason='Authorized maintenance',confirmHostname='other.example.com'))
        self.assertEqual(ops.validate(self.job('DB_STOP',reason='Authorized maintenance',confirmHostname='clinic.example.com'))['action'],'DB_STOP')
    def test_rejects_platform_owner_and_cross_product_roles(self):
        for role in ['PLATFORM_OWNER','admin','ROOT']:
            with self.assertRaises(ops.OwnerOperationError):ops.validate(self.job('USER_UPDATE',userId='user-a',role=role,reason='Owner requested role update'))
    def test_rejects_plaintext_password_and_arbitrary_user_fields(self):
        with self.assertRaises(ops.OwnerOperationError):ops.validate(self.job('USER_CREATE',name='Test User',email='test@example.com',role='ADMIN',reason='Test create',encryptedPassword='a'*400,password='plaintext'))
        with self.assertRaises(ops.OwnerOperationError):ops.validate(self.job('USER_UPDATE',userId='user-a',isActive='false',reason='Disable test'))
    def test_database_commands_use_only_root_registry_target(self):
        job=ops.validate(self.job('DB_STOP',reason='Test stop',confirmHostname='clinic.example.com'))
        with patch.object(ops,'run') as run,patch.object(ops,'database_status',return_value={'databaseRunning':False}):
            self.assertFalse(ops.execute(job)['databaseRunning'])
        self.assertEqual(run.call_args.args[0],['docker','stop','--time','60','client-a-mysql-1'])
    def test_database_start_checks_health(self):
        job=ops.validate(self.job('DB_START',reason='Test start'))
        with patch.object(ops,'run') as run,patch.object(ops,'container_state',return_value={'running':True,'health':'healthy'}),patch.object(ops,'database_status',return_value={'databaseRunning':True}):
            self.assertTrue(ops.execute(job)['databaseRunning'])
        self.assertEqual(run.call_args.args[0],['docker','start','client-a-mysql-1'])
    def test_no_user_execution_while_database_stopped(self):
        job=ops.validate(self.job('USER_LIST'))
        with patch.object(ops,'container_state',return_value={'running':False}),patch.object(ops,'run') as run:
            with self.assertRaises(ops.OwnerOperationError):ops.execute(job)
            run.assert_not_called()
    def test_user_adapter_receives_bound_tenant_through_stdin(self):
        job=ops.validate(self.job('USER_LIST'))
        with patch.object(ops,'container_state',return_value={'running':True}),patch.object(ops,'run',return_value=b'{"users":[]}') as run:
            self.assertEqual(ops.execute(job),{'users':[]})
        args=run.call_args.args[0];data=json.loads(run.call_args.kwargs['data'])
        self.assertEqual(args[:6],['docker','exec','-i','-w','/app','client-a-app-1'])
        self.assertEqual(data['tenantId'],'clinic-a')
    def test_adapter_errors_cannot_expose_credentials(self):
        job=ops.validate(self.job('USER_LIST'))
        failure=subprocess.CalledProcessError(1,['node'],stderr=b'Invalid ORM query password: very-secret-hash')
        with patch.object(ops,'container_state',return_value={'running':True}),patch.object(ops,'run',side_effect=failure):
            with self.assertRaises(ops.OwnerOperationError) as raised:ops.execute(job)
        self.assertNotIn('very-secret',str(raised.exception))
        self.assertIn('check product compatibility',str(raised.exception))

    def test_bad_cipher_is_rejected_without_openssl(self):
        with patch.object(ops,'run') as run:
            with self.assertRaises(ops.OwnerOperationError):ops.decrypt('not-base64')
            run.assert_not_called()

    def test_demo_seed_uses_bound_tenant_and_fixed_adapter(self):
        job=ops.validate(self.job('DEMO_SEED',reason='Prepare demonstration'))
        with patch.object(ops,'container_state',return_value={'running':True}),patch.object(ops,'run',return_value=b'{"seeded":true}') as run:
            self.assertTrue(ops.execute(job)['seeded'])
        args=run.call_args.args[0];data=json.loads(run.call_args.kwargs['data'])
        self.assertEqual(args[:7],['docker','exec','-i','-w','/app','client-a-app-1','node'])
        self.assertEqual(data,{'action':'DEMO_SEED','tenantId':'clinic-a','operationId':'job-a'})

    def test_demo_controls_reject_non_dental_product(self):
        self.target['productKey']='clinic-cms'
        Path(ops.REGISTRY).write_text(json.dumps({'install-a':self.target}))
        job=self.job('DEMO_RESET',reason='Remove demonstration')
        job['installation']['productKey']='clinic-cms'
        with self.assertRaises(ops.OwnerOperationError):ops.validate(job)

if __name__=='__main__':unittest.main()
