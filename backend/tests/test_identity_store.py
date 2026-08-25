import json
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

import pytest
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.licensing.activation import verify_activation_request
from app.licensing.identity_store import (
    InstallationIdentityError,
    InstallationIdentityStore,
    WindowsDpapiMachineProtector,
)


class _TestProtector:
    def __init__(self):
        self._cipher = AESGCM(b"t" * 32)

    def protect(self, plaintext: bytes) -> bytes:
        return b"n" * 12 + self._cipher.encrypt(b"n" * 12, plaintext, b"test-identity-v1")

    def unprotect(self, ciphertext: bytes) -> bytes:
        return self._cipher.decrypt(ciphertext[:12], ciphertext[12:], b"test-identity-v1")


def store(path: Path, product: str = "dental-erp") -> InstallationIdentityStore:
    return InstallationIdentityStore(path, product, _TestProtector())


def test_identity_is_created_once_and_stable(tmp_path: Path) -> None:
    identity_store = store(tmp_path)
    first = identity_store.load_or_create(now=datetime(2026, 8, 24, tzinfo=UTC))
    second = identity_store.load_or_create(now=datetime(2030, 1, 1, tzinfo=UTC))
    assert second.installation_id == first.installation_id
    assert (tmp_path / "identity.key.dpapi").read_bytes() != first.private_seed
    assert first.private_seed.hex() not in (tmp_path / "installation.json").read_text()


def test_public_metadata_tampering_is_detected(tmp_path: Path) -> None:
    identity_store = store(tmp_path)
    identity_store.load_or_create()
    metadata_path = tmp_path / "installation.json"
    metadata = json.loads(metadata_path.read_text())
    metadata["installation_id"] = "changed-installation"
    metadata_path.write_text(json.dumps(metadata))
    with pytest.raises(InstallationIdentityError, match="metadata was changed"):
        identity_store.load_or_create()


@pytest.mark.parametrize("missing", ["identity.key.dpapi", "installation.json"])
def test_partial_identity_loss_never_silently_regenerates(tmp_path: Path, missing: str) -> None:
    identity_store = store(tmp_path)
    original = identity_store.load_or_create()
    (tmp_path / missing).unlink()
    with pytest.raises(InstallationIdentityError, match="incomplete"):
        identity_store.load_or_create()
    remaining = list(tmp_path.glob("identity.key.dpapi")) + list(tmp_path.glob("installation.json"))
    assert all(original.installation_id not in path.name for path in remaining)


def test_product_mismatch_is_detected(tmp_path: Path) -> None:
    store(tmp_path, "dental-erp").load_or_create()
    with pytest.raises(InstallationIdentityError, match="another product"):
        store(tmp_path, "clinic-cms").load_or_create()


def test_concurrent_creation_returns_one_identity(tmp_path: Path) -> None:
    identity_store = store(tmp_path)
    barrier = threading.Barrier(16)

    def create(_: int) -> str:
        barrier.wait()
        return identity_store.load_or_create().installation_id

    with ThreadPoolExecutor(max_workers=16) as executor:
        identities = list(executor.map(create, range(16)))
    assert len(set(identities)) == 1


def test_store_exports_a_verifiable_online_or_offline_request(tmp_path: Path) -> None:
    identity_store = store(tmp_path)
    offline = verify_activation_request(
        identity_store.create_activation_request(app_version="1.0.0", delivery="offline")
    )
    online = verify_activation_request(
        identity_store.create_activation_request(app_version="1.0.0", delivery="online")
    )
    assert offline.installation_id == online.installation_id
    assert {offline.delivery, online.delivery} == {"offline", "online"}


def test_real_dpapi_adapter_is_refused_off_windows() -> None:
    if __import__("os").name == "nt":
        pytest.skip("covered by the Windows DPAPI round-trip test")
    with pytest.raises(OSError, match="only on Windows"):
        WindowsDpapiMachineProtector("dental-erp")
