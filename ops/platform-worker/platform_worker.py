#!/usr/bin/env python3
"""Allowlisted host worker for control-plane operations.

The web application never receives the Docker socket. This root-owned worker
polls signed jobs, constructs every filesystem path itself, and accepts only
four explicit operations against managed client directories.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HOST = re.compile(r"^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")
PROJECT = re.compile(r"^client-[a-z0-9]+(?:-[a-z0-9]+)*$")
PRODUCTS = {"dental-erp", "clinic-cms"}
ACTIONS = {"PROVISION", "DEPLOY", "RESTART", "BACKUP"}

CONTROL_URL = os.environ.get("CONTROL_PLANE_URL", "").rstrip("/")
WORKER_TOKEN = os.environ.get("PLATFORM_WORKER_TOKEN", "")
CLIENT_ROOT = Path(os.environ.get("CLIENT_ROOT", "/opt/clients")).resolve()
BACKUP_ROOT = Path(os.environ.get("BACKUP_ROOT", "/opt/backups/clients")).resolve()
CADDY_SITES = Path(os.environ.get("CADDY_SITES_DIR", "/opt/kora/sites")).resolve()
TEMPLATE_ROOT = Path(__file__).resolve().parent / "templates"
POLL_SECONDS = max(2, int(os.environ.get("POLL_SECONDS", "8")))


class JobError(RuntimeError):
    pass


def request(path: str, *, method: str = "GET", payload: dict[str, Any] | None = None) -> tuple[int, Any]:
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        f"{CONTROL_URL}{path}",
        data=body,
        method=method,
        headers={"Authorization": f"Bearer {WORKER_TOKEN}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        if exc.code == 204:
            return 204, None
        raw = exc.read().decode(errors="replace")
        raise JobError(f"Control plane returned HTTP {exc.code}: {raw[:500]}") from exc


def run(args: list[str], *, cwd: Path | None = None, stdout: Any = None, timeout: int = 900) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        args,
        cwd=cwd,
        stdin=subprocess.DEVNULL,
        stdout=stdout if stdout is not None else subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
        timeout=timeout,
    )


def validate_job(job: dict[str, Any]) -> dict[str, Any]:
    action = job.get("action")
    install = job.get("installation")
    if action not in ACTIONS or not isinstance(install, dict):
        raise JobError("Unsupported operation payload")
    slug = install.get("slug")
    hostname = install.get("hostname")
    project = install.get("composeProject")
    product = install.get("productKey")
    version = install.get("version")
    if not isinstance(slug, str) or not SLUG.fullmatch(slug):
        raise JobError("Invalid installation slug")
    if not isinstance(hostname, str) or not HOST.fullmatch(hostname):
        raise JobError("Invalid installation hostname")
    if project != f"client-{slug}" or not PROJECT.fullmatch(project):
        raise JobError("Invalid compose project")
    if product not in PRODUCTS:
        raise JobError("Unsupported product adapter")
    if not isinstance(version, str) or not version or len(version) > 100:
        raise JobError("An exact release version is required")
    root = (CLIENT_ROOT / slug).resolve()
    if root.parent != CLIENT_ROOT:
        raise JobError("Client path escaped managed root")
    return {**job, "installation": {**install, "root": root}}


def secret(length: int = 32) -> str:
    return secrets.token_urlsafe(length)


def write_private(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(0o600)


def env_text(install: dict[str, Any]) -> str:
    features = install.get("features") if isinstance(install.get("features"), dict) else {}
    common = {
        "COMPOSE_PROJECT_NAME": install["composeProject"],
        "CLIENT_SLUG": install["slug"],
        "HOSTNAME": install["hostname"],
        "IMAGE_TAG": install["version"],
        "LICENSE_ENFORCEMENT": "disabled",
    }
    if install["productKey"] == "dental-erp":
        values = {
            **common,
            "MYSQL_ROOT_PASSWORD": secret(36),
            "MYSQL_PASSWORD": secret(36),
            "NEXTAUTH_SECRET": secret(48),
            "ENCRYPTION_KEY": secrets.token_hex(32),
            "CRON_SECRET": secrets.token_hex(24),
            "SITE_ID": "default",
            "FEATURE_HANDWRITTEN_DIAGNOSIS": "true" if features.get("handwrittenDiagnosis") is True else "false",
        }
    else:
        values = {
            **common,
            "POSTGRES_PASSWORD": secret(36),
            "CLINIC_OWNER_PASSWORD": secret(36),
            "CLINIC_APP_PASSWORD": secret(36),
            "JWT_SECRET": secret(48),
        }
    return "".join(f"{key}={value}\n" for key, value in values.items())


def compose(install: dict[str, Any], *args: str, timeout: int = 1200) -> subprocess.CompletedProcess[bytes]:
    root: Path = install["root"]
    return run(["docker", "compose", "--env-file", ".env", "-f", "compose.yml", *args], cwd=root, timeout=timeout)


def write_caddy_site(install: dict[str, Any]) -> None:
    CADDY_SITES.mkdir(parents=True, exist_ok=True)
    path = CADDY_SITES / f"{install['slug']}.caddy"
    path.write_text(
        f"{install['hostname']} {{\n  encode zstd gzip\n  reverse_proxy {install['slug']}-web:3000\n}}\n",
        encoding="utf-8",
    )
    run(["docker", "exec", "kora-caddy-1", "caddy", "validate", "--config", "/etc/caddy/Caddyfile"])
    run(["docker", "exec", "kora-caddy-1", "caddy", "reload", "--config", "/etc/caddy/Caddyfile"])


def provision(install: dict[str, Any]) -> dict[str, Any]:
    root: Path = install["root"]
    if root.exists() and not (root / ".managed-by-product-platform").exists():
        raise JobError("Refusing to adopt an unmanaged directory")
    root.mkdir(parents=True, exist_ok=True)
    marker = root / ".managed-by-product-platform"
    marker.touch(exist_ok=True)
    shutil.copy2(TEMPLATE_ROOT / f"{install['productKey']}.compose.yml", root / "compose.yml")
    if install["productKey"] == "clinic-cms":
        target = root / "postgres-init"
        target.mkdir(exist_ok=True)
        shutil.copy2(TEMPLATE_ROOT / "postgres-init" / "00-roles.sql", target / "00-roles.sql")
        shutil.copy2(TEMPLATE_ROOT / "postgres-init" / "01-prod-passwords.sh", target / "01-prod-passwords.sh")
        (target / "01-prod-passwords.sh").chmod(0o755)
    env_path = root / ".env"
    if not env_path.exists():
        write_private(env_path, env_text(install))
    compose(install, "config", "--quiet")
    compose(install, "pull")
    compose(install, "up", "-d", "--remove-orphans")
    write_caddy_site(install)
    return {"message": "Installation provisioned", "composeProject": install["composeProject"]}


def update_feature_env(install: dict[str, Any]) -> None:
    if install["productKey"] != "dental-erp":
        return
    path: Path = install["root"] / ".env"
    lines = path.read_text(encoding="utf-8").splitlines()
    enabled = install.get("features", {}).get("handwrittenDiagnosis") is True
    key = "FEATURE_HANDWRITTEN_DIAGNOSIS="
    output = [line for line in lines if not line.startswith(key)]
    output.append(f"{key}{str(enabled).lower()}")
    write_private(path, "\n".join(output) + "\n")


def deploy(install: dict[str, Any]) -> dict[str, Any]:
    root: Path = install["root"]
    if not (root / ".managed-by-product-platform").exists():
        raise JobError("Installation is not managed by this worker")
    update_feature_env(install)
    compose(install, "pull")
    compose(install, "up", "-d", "--remove-orphans")
    return {"message": "Release deployed", "version": install.get("version")}


def restart(install: dict[str, Any]) -> dict[str, Any]:
    if not (install["root"] / ".managed-by-product-platform").exists():
        raise JobError("Installation is not managed by this worker")
    service = "app" if install["productKey"] == "dental-erp" else "web"
    compose(install, "restart", service, timeout=300)
    return {"message": f"{service} restarted"}


def backup(install: dict[str, Any]) -> dict[str, Any]:
    if not (install["root"] / ".managed-by-product-platform").exists():
        raise JobError("Installation is not managed by this worker")
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    target_dir = (BACKUP_ROOT / install["slug"]).resolve()
    if target_dir.parent != BACKUP_ROOT:
        raise JobError("Backup path escaped managed root")
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{timestamp}.sql.gz"
    if install["productKey"] == "dental-erp":
        command = ["docker", "compose", "--env-file", ".env", "-f", "compose.yml", "exec", "-T", "mysql", "sh", "-c", 'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"']
    else:
        command = ["docker", "compose", "--env-file", ".env", "-f", "compose.yml", "exec", "-T", "postgres", "pg_dump", "-U", "postgres", "clinic"]
    with target.open("wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", compresslevel=6) as compressed:
        run(command, cwd=install["root"], stdout=compressed, timeout=1200)
    digest = file_sha256(target)
    (target.with_suffix(target.suffix + ".sha256")).write_text(f"{digest}  {target.name}\n", encoding="ascii")
    target.chmod(0o600)
    files = [{"file": target.name, "sha256": digest}]
    if install["productKey"] == "dental-erp":
        app_data = target_dir / f"{timestamp}.app-data.tar.gz"
        archive_command = [
            "docker", "compose", "--env-file", ".env", "-f", "compose.yml",
            "exec", "-T", "app", "tar", "-C", "/app", "-czf", "-", "uploads", ".license-state",
        ]
        with app_data.open("wb") as output:
            run(archive_command, cwd=install["root"], stdout=output, timeout=1200)
        app_digest = file_sha256(app_data)
        (app_data.with_suffix(app_data.suffix + ".sha256")).write_text(
            f"{app_digest}  {app_data.name}\n", encoding="ascii"
        )
        app_data.chmod(0o600)
        files.append({"file": app_data.name, "sha256": app_digest})
    return {"message": "Backup completed", "files": files, "backupCompleted": True}


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def execute(job: dict[str, Any]) -> dict[str, Any]:
    install = job["installation"]
    return {
        "PROVISION": provision,
        "DEPLOY": deploy,
        "RESTART": restart,
        "BACKUP": backup,
    }[job["action"]](install)


def report(job_id: str, status: str, *, result: dict[str, Any] | None = None, error: str | None = None) -> None:
    result = result or {}
    request(
        f"/api/platform/worker/jobs/{job_id}/result",
        method="POST",
        payload={
            "status": status,
            "result": result,
            "error": error,
            "version": result.get("version"),
            "backupCompleted": result.get("backupCompleted", False),
        },
    )


def tick() -> bool:
    status, raw = request("/api/platform/worker/jobs/next")
    if status == 204:
        return False
    if not isinstance(raw, dict) or not isinstance(raw.get("id"), str):
        raise JobError("Invalid control-plane response")
    job_id = raw["id"]
    try:
        job = validate_job(raw)
        result = execute(job)
        report(job_id, "SUCCEEDED", result=result)
    except Exception as exc:
        report(job_id, "FAILED", error=str(exc)[:10_000])
    return True


def main() -> int:
    if not CONTROL_URL.startswith("https://") or len(WORKER_TOKEN) < 32:
        print("CONTROL_PLANE_URL=https://... and a strong PLATFORM_WORKER_TOKEN are required", file=sys.stderr)
        return 2
    CLIENT_ROOT.mkdir(parents=True, exist_ok=True)
    BACKUP_ROOT.mkdir(parents=True, exist_ok=True)
    while True:
        try:
            worked = tick()
            if not worked:
                time.sleep(POLL_SECONDS)
        except Exception as exc:
            print(f"worker error: {exc}", file=sys.stderr, flush=True)
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    raise SystemExit(main())
