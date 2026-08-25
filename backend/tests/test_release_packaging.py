import json
import sys
from pathlib import Path

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

sys.path.insert(0, str(Path(__file__).parents[2]))

from scripts.embed_license_trust_anchors import parse_keys, render_python, render_typescript


def test_tagged_release_refuses_empty_trust_ring() -> None:
    with pytest.raises(ValueError, match="requires at least one"):
        parse_keys("{}", require_nonempty=True)


def test_release_rejects_private_or_non_ed25519_material() -> None:
    with pytest.raises(ValueError, match="invalid PEM"):
        parse_keys(json.dumps({"issuer-1": "PRIVATE KEY"}), require_nonempty=True)


def test_generated_sources_contain_only_supplied_public_values() -> None:
    from cryptography.hazmat.primitives import serialization

    pem = (
        Ed25519PrivateKey.from_private_bytes(b"r" * 32)
        .public_key()
        .public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode("ascii")
    )
    keys = parse_keys(json.dumps({"issuer-2026-01": pem}), require_nonempty=True)
    python = render_python(keys)
    typescript = render_typescript(keys)
    assert "issuer-2026-01" in python and "issuer-2026-01" in typescript
    assert "PRIVATE KEY" not in python and "PRIVATE KEY" not in typescript


def test_bundle_manifest_hashes_every_required_file(tmp_path: Path) -> None:
    from scripts.build_offline_bundle_manifest import build_manifest

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
        path = tmp_path / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(relative)
    manifest = build_manifest(
        tmp_path,
        app_version="1.0.0",
        app_image="ghcr.io/sunny/dental-erp:1.0.0",
        database_image="mysql:8.4",
    )
    assert {entry["path"] for entry in manifest["files"]} == set(required)
    assert all(len(entry["sha256"]) == 64 for entry in manifest["files"])


def test_bundle_manifest_refuses_partial_bundle(tmp_path: Path) -> None:
    from scripts.build_offline_bundle_manifest import build_manifest

    with pytest.raises(ValueError, match="missing"):
        build_manifest(
            tmp_path,
            app_version="1.0.0",
            app_image="ghcr.io/sunny/dental-erp:1.0.0",
            database_image="mysql:8.4",
        )


def test_windows_workflows_build_importable_agent_and_run_installer_tests() -> None:
    root = Path(__file__).parents[2]
    release = (root / ".github/workflows/release.yml").read_text(encoding="utf-8")
    windows = (root / ".github/workflows/licensing-windows.yml").read_text(encoding="utf-8")

    assert "pyinstaller --clean --onefile --paths ." in release
    assert "pyinstaller --clean --onefile --paths ." in windows
    assert "Invoke-Pester" in windows
