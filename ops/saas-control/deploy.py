#!/usr/bin/env python3
"""Promote a locally loaded, vendor-approved release. Run as root on the VPS.

No build, Git checkout, registry latest tag, secret output, or clinical schema
migration. Existing clinic and vendor Compose projects retain their volumes.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import re
import secrets
import shutil
import subprocess
import tempfile
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path('/opt/dental-saas')
CLINIC = Path('/opt/dental-erp')
CONTROL = Path('/opt/product-control')


def run(args, *, data=None, stdout=None, check=True):
    result = subprocess.run(args, input=data, stdout=stdout or subprocess.PIPE,
                            stderr=subprocess.PIPE, check=False)
    if check and result.returncode:
        # Command arguments never contain credentials. Docker error output may;
        # keep raw diagnostics on the protected server, outside task output.
        ROOT.mkdir(mode=0o700, exist_ok=True)
        private(ROOT / 'last-error.log', result.stderr.decode(errors='replace'))
        raise RuntimeError(f'Command failed ({result.returncode}): {args[0:4]}; see private last-error.log')
    return result.stdout or b''


def private(path, text):
    path.write_text(text)
    path.chmod(0o600)


def env(path):
    values = {}
    if path.exists():
        for line in path.read_text().splitlines():
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                values[key] = value.strip().strip('"').strip("'")
    return values


def update_env(path, updates):
    lines = path.read_text().splitlines() if path.exists() else []
    lines = [line for line in lines if line.split('=', 1)[0] not in updates]
    lines.extend(f'{key}={value}' for key, value in updates.items())
    private(path, '\n'.join(lines) + '\n')


def compose(base, env_file, *args, overlay=None):
    command = ['docker', 'compose', '--env-file', str(env_file), '-f', str(base)]
    if overlay:
        command += ['-f', str(overlay)]
    return run(command + list(args))


def db_count(container):
    return run(['docker', 'exec', container, 'sh', '-c',
                'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root -N "$MYSQL_DATABASE" '
                '-e "SELECT COUNT(*) FROM Hospital; SELECT COUNT(*) FROM User; SELECT COUNT(*) FROM Patient;"']).decode().strip()


def backup_and_restore_check(target):
    target.mkdir(mode=0o700, parents=True)
    counts = {}
    for container in ['dental-mysql', 'product-control-mysql']:
        counts[container] = db_count(container)
        with tempfile.TemporaryFile() as raw:
            run(['docker', 'exec', container, 'sh', '-c',
                 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -u root '
                 '--single-transaction --routines --triggers --set-gtid-purged=OFF --no-tablespaces "$MYSQL_DATABASE"'], stdout=raw)
            raw.seek(0)
            with gzip.open(target / f'{container}.sql.gz', 'wb') as compressed:
                shutil.copyfileobj(raw, compressed)
    postgres = run(['docker', 'ps', '-q', '--filter', 'label=com.docker.compose.project=dental-saas',
                    '--filter', 'label=com.docker.compose.service=postgres']).decode().strip()
    if postgres:
        with (target / 'saas-control.dump').open('wb') as output:
            run(['docker', 'exec', postgres, 'pg_dump', '-U', 'dental_saas', '-Fc', 'dental_saas'], stdout=output)
    with (target / 'clinic-uploads.tar.gz').open('wb') as output:
        run(['docker', 'exec', 'dental-web', 'tar', '-C', '/app', '-czf', '-', 'uploads'], stdout=output)
    for base in [CLINIC, CONTROL]:
        shutil.copy2(base / '.env', target / f'{base.name}.env')
    for label, path in [('clinic-compose.yml', CLINIC / 'compose.vps.yml'),
                        ('control-compose.yml', CONTROL / 'compose.yml')]:
        shutil.copy2(path, target / label)
    # A separate empty database verifies that both backups actually restore.
    scratch = 'dental-saas-restore-check'
    scratch_env = target / 'restore.env'
    private(scratch_env, f'MYSQL_ROOT_PASSWORD={secrets.token_hex(24)}\nMYSQL_DATABASE=restore_check\n')
    run(['docker', 'run', '-d', '--name', scratch, '--network', 'none', '--memory', '512m',
         '--env-file', str(scratch_env), '--tmpfs', '/var/lib/mysql:rw,size=384m', 'mysql:8.4'])
    try:
        for _ in range(90):
            result = subprocess.run(['docker', 'exec', scratch, 'sh', '-c',
                                     'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root -N -e "SELECT 1"'],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if result.returncode == 0:
                break
            time.sleep(1)
        else:
            raise RuntimeError('Backup restore database did not start')
        for container in counts:
            with gzip.open(target / f'{container}.sql.gz', 'rb') as source:
                # Current pilot databases are small. No dump or credential enters logs.
                run(['docker', 'exec', '-i', scratch, 'sh', '-c',
                     'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root restore_check'], data=source.read())
            actual = run(['docker', 'exec', scratch, 'sh', '-c',
                          'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root -N restore_check '
                          '-e "SELECT COUNT(*) FROM Hospital; SELECT COUNT(*) FROM User; SELECT COUNT(*) FROM Patient;"']).decode().strip()
            if actual != counts[container]:
                raise RuntimeError(f'Backup restore count mismatch: {container}')
            run(['docker', 'exec', scratch, 'sh', '-c',
                 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root -e "DROP DATABASE restore_check; CREATE DATABASE restore_check;"'])
    finally:
        run(['docker', 'rm', '-f', scratch], check=False)
        scratch_env.unlink(missing_ok=True)
    checksums = {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                 for p in target.iterdir() if p.is_file()}
    private(target / 'verification.json', json.dumps({'restored': True, 'counts': counts, 'sha256': checksums}, indent=2))
    print('Clinic/vendor backups restored successfully; uploads archived.', flush=True)


def service_id(release):
    return compose(release / 'ops/saas-control/compose.yml', ROOT / '.env', 'ps', '-q', 'api').decode().strip()


def register_migration(release):
    # Read branding inside the existing clinic process; do not copy auth secrets.
    js = """const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{const h=await p.hospital.findUniqueOrThrow({where:{id:'cmsx5je3p0000101z5wdiznyh'}});
console.log(JSON.stringify({id:h.id,name:h.name,slug:h.slug,customerId:'lemlem',hostname:'lemlem.dental.clinic-cms.cc',
mode:'hosted',planName:'Migration access',migrationAccess:true,accessUntil:null,
branding:{displayName:h.name,contactPhone:h.phone||'',contactEmail:h.email||'',address:h.address||'',primaryColor:'#0f766e'}}));await p.$disconnect()})().catch(()=>process.exit(1));"""
    tenant = json.loads(run(['docker', 'exec', 'dental-web', 'node', '-e', js]))
    tenant['modules'] = list(json.loads((release / 'config/saas-modules.json').read_text()))
    code = """import json,os,sys,urllib.request
body=json.load(sys.stdin)
headers={'Authorization':'Bearer '+os.environ['BACKEND_SAAS_ADMIN_TOKEN'],'Content-Type':'application/json','X-Actor':'authorized-vps-migration'}
base='http://127.0.0.1:8000/api/saas/admin/tenants'
rows=json.load(urllib.request.urlopen(urllib.request.Request(base,headers=headers)))
if not any(row['tenantId']==body['id'] for row in rows['tenants']):
 response=urllib.request.urlopen(urllib.request.Request(base,data=json.dumps(body).encode(),headers=headers,method='POST'))
 assert response.status==201
print('Lemlem policy registered or already present; existing policy preserved.')
"""
    print(run(['docker', 'exec', '-i', service_id(release), '/app/.venv/bin/python', '-c', code], data=json.dumps(tenant).encode()).decode().strip(), flush=True)


def ready(url):
    for _ in range(40):
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                if response.status == 200:
                    return
        except Exception:
            pass
        time.sleep(2)
    raise RuntimeError(f'Readiness failed: {url}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--version', required=True)
    args = parser.parse_args()
    if os.geteuid() != 0 or not re.fullmatch(r'\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?', args.version):
        raise SystemExit('Root and exact semantic release version required')
    release = Path(__file__).resolve().parents[2]
    manifest = json.loads((release / 'release.json').read_text())
    if manifest['version'] != args.version:
        raise SystemExit('Manifest version mismatch')
    for key in ['frontend', 'backend']:
        image = manifest[key]['image']
        actual = run(['docker', 'image', 'inspect', '--format', '{{.Id}}', image]).decode().strip()
        if actual != manifest[key]['imageId']:
            raise SystemExit(f'Immutable {key} image verification failed')
    ROOT.mkdir(mode=0o700, exist_ok=True)
    ROOT.chmod(0o700)
    if not (ROOT / 'issuer.seed').exists():
        raise SystemExit('Vendor signing seed must be provisioned separately')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = ROOT / 'backups' / stamp
    backup_and_restore_check(backup)
    state_paths = [CLINIC / '.env', CONTROL / '.env', ROOT / 'clinic.release.yml', ROOT / 'control.release.yml']
    previous = {path: path.read_bytes() if path.exists() else None for path in state_paths}
    old_images = {container: run(['docker', 'inspect', '--format', '{{.Image}}', container]).decode().strip()
                  for container in ['dental-web', 'product-control-web']}
    private(backup / 'rollback.json', json.dumps(old_images))
    settings = env(ROOT / '.env')
    for key in ['SAAS_DB_PASSWORD', 'SAAS_BACKEND_JWT_SECRET', 'SAAS_ADMIN_TOKEN', 'SAAS_READER_TOKEN']:
        settings.setdefault(key, secrets.token_hex(32))
    settings.update(SAAS_BACKEND_IMAGE=manifest['backend']['image'], SAAS_ISSUER_SEED_PATH=str(ROOT / 'issuer.seed'))
    update_env(ROOT / '.env', settings)
    saas_compose = release / 'ops/saas-control/compose.yml'
    print('Starting isolated SaaS database, migrations, and issuer.', flush=True)
    compose(saas_compose, ROOT / '.env', 'up', '-d', '--wait', '--wait-timeout', '180')
    register_migration(release)
    image = manifest['frontend']['image']
    for label, service in [('clinic', 'dental-web'), ('control', 'control-web')]:
        private(ROOT / f'{label}.release.yml', json.dumps({
            'services': {service: {'image': image, 'networks': {'dental_saas_gateway': {}}}},
            'networks': {'dental_saas_gateway': {'external': True}}
        }))
    try:
        update_env(CLINIC / '.env', {'SAAS_ENFORCEMENT': 'hosted', 'SAAS_URL': 'http://dental-saas-api:8000',
                                    'SAAS_READER_TOKEN': settings['SAAS_READER_TOKEN']})
        update_env(CONTROL / '.env', {'SAAS_ENFORCEMENT': 'disabled', 'SAAS_URL': 'http://dental-saas-api:8000',
                                     'SAAS_READER_TOKEN': settings['SAAS_READER_TOKEN'],
                                     'SAAS_ADMIN_TOKEN': settings['SAAS_ADMIN_TOKEN']})
        for base, env_file, overlay, service in [
            (CLINIC / 'compose.vps.yml', CLINIC / '.env', ROOT / 'clinic.release.yml', 'dental-web'),
            (CONTROL / 'compose.yml', CONTROL / '.env', ROOT / 'control.release.yml', 'control-web')
        ]:
            compose(base, env_file, 'config', '--quiet', overlay=overlay)
            compose(base, env_file, 'up', '-d', '--no-deps', '--no-build', '--wait', '--wait-timeout', '150', service, overlay=overlay)
        ready('https://lemlem.dental.clinic-cms.cc/api/ready')
        ready('https://control.clinic-cms.cc/api/ready')
    except Exception:
        print('Promotion failed. Restoring prior web images/configuration.', flush=True)
        for path, content in previous.items():
            if content is None:
                path.unlink(missing_ok=True)
            else:
                path.write_bytes(content)
                path.chmod(0o600)
        for label, base, file, service, container in [
            ('clinic', CLINIC / 'compose.vps.yml', CLINIC / '.env', 'dental-web', 'dental-web'),
            ('control', CONTROL / 'compose.yml', CONTROL / '.env', 'control-web', 'product-control-web')
        ]:
            rollback = backup / f'{label}-rollback.yml'
            private(rollback, json.dumps({'services': {service: {'image': old_images[container]}}}))
            compose(base, file, 'up', '-d', '--no-deps', '--no-build', service, overlay=rollback)
        raise
    # Approval is explicit and scoped to immutable images already tested above.
    approvals = Path('/etc/sunny-smile/approved-releases.json')
    approvals.parent.mkdir(mode=0o700, exist_ok=True)
    allowed = json.loads(approvals.read_text()) if approvals.exists() else {}
    allowed[args.version] = {'frontendImage': image, 'frontendImageId': manifest['frontend']['imageId'],
                             'backendImage': manifest['backend']['image'], 'backendImageId': manifest['backend']['imageId']}
    private(approvals, json.dumps(allowed, indent=2))
    worker = Path('/opt/product-platform-worker')
    if worker.is_dir():
        shutil.copy2(release / 'ops/platform-worker/platform_worker.py', worker / 'platform_worker.py')
        shutil.copytree(release / 'ops/platform-worker/templates', worker / 'templates', dirs_exist_ok=True)
        worker_env = Path('/etc/sunny-smile/platform-worker.env')
        update_env(worker_env, {'SAAS_READER_TOKEN': settings['SAAS_READER_TOKEN']})
        run(['systemctl', 'restart', 'product-platform-worker'])
    current = ROOT / 'current'
    temporary = ROOT / 'current.next'
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(release)
    temporary.replace(current)
    private(ROOT / 'deployment.json', json.dumps({'version': args.version, 'release': str(release),
                                                'backup': str(backup), 'deployedAt': stamp}, indent=2))
    print(f'Release {args.version} promoted. Clinic and vendor readiness passed. Backup: {backup}', flush=True)


if __name__ == '__main__':
    main()
