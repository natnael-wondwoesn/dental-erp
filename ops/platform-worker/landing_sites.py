"""Pause and restore landing-page-only client sites.

A landing site is a folder of static files served by Caddy. Pausing swaps the
site's Caddy snippet so the hostname shows the shared "service paused" page;
restoring swaps it back. Nothing is deleted either way.

Only sites listed in a root-owned registry can be touched, and every path is
built here from the registry entry, never from the job.
"""
import json
import os
from pathlib import Path
import re
import subprocess

ACTIONS = {'SITE_STATUS', 'SITE_SUSPEND', 'SITE_RESTORE'}
REGISTRY = Path(os.environ.get('LANDING_SITES_PATH', '/etc/sunny-smile/landing-sites.json'))
CADDY_SITES = Path(os.environ.get('CADDY_SITES_DIR', '/opt/kora/sites'))
# Site folders live under the Caddy sites directory (already mounted into the Caddy
# container as /etc/caddy/sites), so no extra mount or container restart is needed.
SERVE_ROOT = os.environ.get('LANDING_SERVE_ROOT', '/etc/caddy/sites/_landing')
SLUG = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
HOST = re.compile(r'^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$')
IDENT = re.compile(r'^[A-Za-z0-9_-]{1,64}$')


class LandingSiteError(RuntimeError):
    pass


def target_for(installation):
    try:
        stat = REGISTRY.stat()
        if stat.st_uid != os.geteuid() or stat.st_mode & 0o022:
            raise LandingSiteError('Landing site registry permissions are unsafe')
        target = json.loads(REGISTRY.read_text())[installation['id']]
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise LandingSiteError('Site is not registered for suspend/restore') from exc
    if target.get('hostname') != installation.get('hostname') or installation.get('productKey') != 'landing-site':
        raise LandingSiteError('Site binding mismatch')
    if not SLUG.fullmatch(target.get('slug', '')) or not HOST.fullmatch(target.get('hostname', '')):
        raise LandingSiteError('Invalid site binding')
    return target


def validate(job):
    action = job.get('action')
    install = job.get('installation')
    payload = job.get('request')
    if action not in ACTIONS or not isinstance(install, dict) or not isinstance(payload, dict):
        raise LandingSiteError('Invalid site operation')
    if payload.get('action') != action:
        raise LandingSiteError('Invalid site operation')
    allowed = {'action'} if action == 'SITE_STATUS' else {'action', 'reason'}
    if action != 'SITE_STATUS' and not (isinstance(payload.get('reason'), str) and 3 <= len(payload['reason']) <= 500):
        raise LandingSiteError('Audit reason required')
    if payload.keys() - allowed:
        raise LandingSiteError('Unexpected site operation fields')
    if not isinstance(job.get('id'), str) or not IDENT.fullmatch(job['id']):
        raise LandingSiteError('Invalid operation ID')
    return {**job, 'siteTarget': target_for(install)}


def snippet(target, paused):
    host, slug = target['hostname'], target['slug']
    if paused:
        return (
            f"{host} {{\n"
            f"  encode zstd gzip\n"
            f"  header Cache-Control \"no-store\"\n"
            f"  root * {SERVE_ROOT}/_paused\n"
            f"  error * \"paused\" 503\n"
            f"  handle_errors {{\n"
            f"    rewrite * /index.html\n"
            f"    file_server\n"
            f"  }}\n"
            f"}}\n"
        )
    return (
        f"{host} {{\n"
        f"  encode zstd gzip\n"
        f"  root * {SERVE_ROOT}/{slug}/current\n"
        f"  file_server\n"
        f"  handle_errors {{\n"
        f"    rewrite * /404.html\n"
        f"    file_server\n"
        f"  }}\n"
        f"}}\n"
    )


def is_paused(target):
    path = CADDY_SITES / f"{target['slug']}.caddy"
    try:
        return '/_paused' in path.read_text()
    except OSError:
        return False


def run(args):
    return subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, timeout=60)


def apply(target, paused):
    CADDY_SITES.mkdir(parents=True, exist_ok=True)
    path = CADDY_SITES / f"{target['slug']}.caddy"
    previous = path.read_text() if path.exists() else None
    path.write_text(snippet(target, paused), encoding='utf-8')
    try:
        run(['docker', 'exec', 'kora-caddy-1', 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile'])
        run(['docker', 'exec', 'kora-caddy-1', 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile'])
    except (subprocess.SubprocessError, OSError) as exc:
        # Never leave the proxy with a config that does not load.
        if previous is None:
            path.unlink(missing_ok=True)
        else:
            path.write_text(previous, encoding='utf-8')
        raise LandingSiteError('Web server rejected the change; the site was left as it was') from exc


def execute(job):
    target = job['siteTarget']
    action = job['action']
    if action == 'SITE_SUSPEND' and not is_paused(target):
        apply(target, True)
    elif action == 'SITE_RESTORE' and is_paused(target):
        apply(target, False)
    paused = is_paused(target)
    return {'sitePaused': paused, 'message': 'Site is paused' if paused else 'Site is live'}
