#!/usr/bin/env python3
"""Verify live issuer/trust-anchor compatibility without exporting private key."""
import subprocess
from pathlib import Path

release = Path(__file__).resolve().parents[2]
api = subprocess.check_output(['docker', 'compose', '--env-file', '/opt/dental-saas/.env', '-f',
                              str(release / 'ops/saas-control/compose.yml'), 'ps', '-q', 'api']).decode().strip()
code = '''import asyncio,json,os,uuid,urllib.request
from datetime import UTC,datetime,timedelta
from sqlalchemy import delete
from app.database import SessionFactory
from app.saas.models import SaaSTenant,SaaSAuditEvent,SaaSLicenseIssuance
from app.licensing.activation import create_activation_request,generate_installation_identity,verify_activation_request
from app.licensing.decision import evaluate_license
from app.licensing.trust_anchors import ISSUER_PUBLIC_KEYS
id='license-smoke-'+uuid.uuid4().hex[:16]
headers={'Authorization':'Bearer '+os.environ['BACKEND_SAAS_ADMIN_TOKEN'],'Content-Type':'application/json','X-Actor':'release-acceptance'}
def call(path,body):
 req=urllib.request.Request('http://127.0.0.1:8000/api/saas/admin/'+path,method='POST',data=json.dumps(body).encode(),headers=headers)
 return json.load(urllib.request.urlopen(req))
async def cleanup():
 async with SessionFactory() as session:
  for model in [SaaSLicenseIssuance,SaaSAuditEvent]:
   await session.execute(delete(model).where(model.tenant_id==id))
  await session.execute(delete(SaaSTenant).where(SaaSTenant.id==id))
  await session.commit()
try:
 call('tenants',{'id':id,'name':'Synthetic offline acceptance','slug':id,'customerId':id,'mode':'offline',
  'modules':['core','patients'],'accessUntil':(datetime.now(UTC)+timedelta(days=1)).isoformat()})
 activation=create_activation_request(generate_installation_identity(),product_id='dental-erp',app_version='0.1.0-saas.20261018',delivery='offline')
 first=call('tenants/'+id+'/license',{'activationRequest':activation})
 assert first==call('tenants/'+id+'/license',{'activationRequest':activation})
 installation=verify_activation_request(activation).installation_id
 result=evaluate_license(license=json.dumps(first),product_id='dental-erp',installation_id=installation,public_keys=ISSUER_PUBLIC_KEYS,now=datetime.now(UTC))
 assert result.state=='active', result.reason
 assert result.payload.customer_id==id
 assert set(result.payload.entitlements)=={'module:core','module:patients'}
 wrong=evaluate_license(license=json.dumps(first),product_id='dental-erp',installation_id='wrong-installation',public_keys=ISSUER_PUBLIC_KEYS,now=datetime.now(UTC))
 assert wrong.state=='invalid'
 print('PASS live Ed25519 signing, shipped trust anchor, exact grants, installation binding and idempotence')
finally:
 asyncio.run(cleanup())
 print('Synthetic license fixtures removed; signer private key stayed in issuer container')
'''
subprocess.run(['docker', 'exec', api, '/app/.venv/bin/python', '-c', code], check=True)
