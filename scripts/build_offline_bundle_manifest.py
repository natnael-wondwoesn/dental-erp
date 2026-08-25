"""Create the corruption-checking manifest inside an assembled offline USB bundle."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_manifest(
    root: Path,
    *,
    app_version: str,
    app_image: str,
    database_image: str,
) -> dict[str, object]:
    required = [
        "Install-Offline.ps1",
        "Configure-Direct-Cable-Client.ps1",
        "OfflineInstaller.psm1",
        "compose.offline.yml",
        "bin/dental-license-agent.exe",
        "images/dental-erp.tar",
        "images/mysql-8.4.tar",
    ]
    for relative in required:
        if not (root / relative).is_file():
            raise ValueError(f"offline bundle is missing {relative}")
    files = [
        {"path": path.relative_to(root).as_posix(), "sha256": sha256(path)}
        for path in sorted(root.rglob("*"))
        if path.is_file() and path.name != "bundle-manifest.json"
    ]
    return {
        "schema_version": 1,
        "product_id": "dental-erp",
        "app_version": app_version,
        "app_image": app_image,
        "database_image": database_image,
        "license_agent": "bin/dental-license-agent.exe",
        "container_archives": ["images/dental-erp.tar", "images/mysql-8.4.tar"],
        "files": files,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--app-version", required=True)
    parser.add_argument("--app-image", required=True)
    parser.add_argument("--database-image", default="mysql:8.4")
    arguments = parser.parse_args()
    manifest = build_manifest(
        arguments.root,
        app_version=arguments.app_version,
        app_image=arguments.app_image,
        database_image=arguments.database_image,
    )
    (arguments.root / "bundle-manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
