#!/usr/bin/env python3
"""Live SaaS acceptance using isolated, disposable clinic fixtures only.

Run on VPS after promotion. Tokens are minted and consumed inside containers;
no credentials or patient data are emitted. Fixture clinical data is synthetic.
"""
import json
from concurrent.futures import ThreadPoolExecutor
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4


def run(args, data=None):
    return subprocess.check_output(args, input=data)


def main():
    release = Path(__file__).resolve().parents[2]
    api = run(['docker', 'compose', '--env-file', '/opt/dental-saas/.env', '-f',
               str(release / 'ops/saas-control/compose.yml'), 'ps', '-q', 'api']).decode().strip()
    prefix = 'saas-smoke-' + uuid4().hex[:12]
    ids = [prefix + '-a', prefix + '-b']
    call_code = '''import json,os,sys,urllib.request,urllib.error
x=json.load(sys.stdin)
r=urllib.request.Request('http://127.0.0.1:8000/api/saas/'+x['path'],method=x['method'],
 headers={'Authorization':'Bearer '+os.environ['BACKEND_SAAS_ADMIN_TOKEN'],'Content-Type':'application/json','X-Actor':'release-acceptance'},
 data=json.dumps(x['body']).encode() if x.get('body') is not None else None)
with urllib.request.urlopen(r) as response: print(response.read().decode())
'''
    def call(path, method='GET', body=None):
        return json.loads(run(['docker', 'exec', '-i', api, '/app/.venv/bin/python', '-c', call_code],
                              json.dumps(dict(path=path, method=method, body=body)).encode()))

    js = r'''
const {PrismaClient}=require('@prisma/client');
const crypto=require('node:crypto');
const p=new PrismaClient();
async function main(){
 const {ids,phase}=JSON.parse(require('fs').readFileSync(0,'utf8'));
 if(phase==='setup') {
  for(const id of ids){
   await p.hospital.create({data:{id,name:id,slug:id,email:id+'@example.invalid',plan:'SELF_HOSTED'}});
   await p.user.create({data:{id:id+'-admin',hospitalId:id,email:id+'-admin@example.invalid',password:'unusable-test-password',name:'Synthetic Test',role:'ADMIN',isHospitalAdmin:true}});
  }
  await p.patient.create({data:{id:ids[1]+'-record',hospitalId:ids[1],patientId:'TEST-ONLY',firstName:'Synthetic',lastName:'Fixture',phone:'+251911000000'}});
 }
 if(phase==='cleanup') {
  for(const id of ids) await p.hospital.deleteMany({where:{id}});
  return;
 }
 const id=ids[0];
 const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const now=Math.floor(Date.now()/1000);
 const payload=Buffer.from(JSON.stringify({sub:id+'-admin',hospitalId:id,role:'ADMIN',email:id+'-admin@example.invalid',name:'Synthetic Test',isHospitalAdmin:true,iat:now,exp:now+300})).toString('base64url');
 const unsigned=header+'.'+payload;
 const token=unsigned+'.'+crypto.createHmac('sha256',process.env.NEXTAUTH_SECRET).update(unsigned).digest('base64url');
 async function check(path,status,method='GET',body){
  const r=await fetch('http://127.0.0.1:3000'+path,{method,headers:{Authorization:'Bearer '+token,
   Host:'lemlem.dental.clinic-cms.cc','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'manual'});
  if(r.status!==status) throw new Error(phase+' '+path+' expected '+status+' got '+r.status+' '+(await r.text()).slice(0,160));
 }
 const patient={firstName:'Synthetic',lastName:'ReleaseCheck',phone:'+251911000001'};
 if(phase==='setup'){
  await check('/api/patients',200);
  await check('/api/patients',201,'POST',patient);
  await check('/api/invoices',403);
  await check('/api/patients/'+ids[1]+'-record',404);
  await check('/api/saas-admin/tenants',404);
  console.log('PASS active writes, module denial, cross-clinic denial, vendor separation');
 }
 if(phase==='suspended'){
  await check('/api/patients',423,'POST',patient);
  await check('/api/patients',200);
  await check('/api/recovery',200);
  console.log('PASS suspended writes locked; reads/recovery available');
 }
 if(phase==='restored'){
  await check('/api/patients',201,'POST',{...patient,phone:'+251911000002'});
  console.log('PASS restoration affects existing session immediately');
 }
 if(phase==='revoked'){
  await check('/api/patients',403);
  await check('/api/recovery',200);
  console.log('PASS module revocation affects existing session; recovery retained');
 }
}
main().then(()=>p.$disconnect()).catch(async e=>{console.error(e.message);await p.$disconnect();process.exit(1)});
'''
    def phase(name):
        output = run(['docker', 'exec', '-i', 'dental-web', 'node', '-e', js],
                     json.dumps({'ids': ids, 'phase': name}).encode())
        if output:
            print(output.decode().strip(), flush=True)

    try:
        for index, tenant_id in enumerate(ids):
            call('admin/tenants', 'POST', {
                'id': tenant_id, 'name': tenant_id, 'slug': tenant_id, 'customerId': tenant_id,
                'modules': ['core', 'patients'] + (['billing'] if index else []),
                'accessUntil': (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            })
        phase('setup')
        with ThreadPoolExecutor(max_workers=2) as pool:
            def renew(_):
                return call(f'admin/tenants/{ids[0]}/renew', 'POST',
                            {'reference': 'synthetic-idempotency-check', 'amount': '1.00', 'months': 1})
            payments = list(pool.map(renew, range(2)))
        assert payments[0]['paymentId'] == payments[1]['paymentId']
        assert sorted(x['duplicate'] for x in payments) == [False, True]
        print('PASS concurrent renewal idempotence against production Postgres', flush=True)
        current = call('admin/tenants')['tenants']
        first = next(x for x in current if x['tenantId'] == ids[0])
        suspended = call(f'admin/tenants/{ids[0]}/suspension', 'PUT', {
            'revision': first['revision'], 'suspended': True, 'reason': 'Synthetic release acceptance',
        })
        phase('suspended')
        restored = call(f'admin/tenants/{ids[0]}/suspension', 'PUT', {
            'revision': suspended['revision'], 'suspended': False, 'reason': 'Synthetic acceptance restoration',
        })
        phase('restored')
        call(f'admin/tenants/{ids[0]}/modules', 'PUT', {'revision': restored['revision'], 'modules': ['core']})
        phase('revoked')
    finally:
        try:
            phase('cleanup')
        except subprocess.CalledProcessError:
            print('Clinical fixture cleanup failed; removing commercial fixtures independently.', flush=True)
        cleanup = '''import asyncio,json,sys
from sqlalchemy import delete
from app.database import SessionFactory
from app.saas.models import SaaSTenant,SaaSAuditEvent,SaaSPayment,SaaSLicenseIssuance
ids=json.load(sys.stdin)
async def main():
 async with SessionFactory() as session:
  for model in [SaaSLicenseIssuance,SaaSPayment,SaaSAuditEvent]:
   await session.execute(delete(model).where(model.tenant_id.in_(ids)))
  await session.execute(delete(SaaSTenant).where(SaaSTenant.id.in_(ids)))
  await session.commit()
asyncio.run(main())
'''
        run(['docker', 'exec', '-i', api, '/app/.venv/bin/python', '-c', cleanup], json.dumps(ids).encode())
        print('Synthetic fixtures removed; real clinic policy untouched.', flush=True)


if __name__ == '__main__':
    main()
