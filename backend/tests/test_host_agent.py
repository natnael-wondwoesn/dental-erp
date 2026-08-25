import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.licensing.activation import verify_activation_request
from app.licensing.host_agent import HostLicenseAgent
from app.licensing.identity_store import InstallationIdentityStore
from app.licensing.issuer import (
    Ed25519LicenseSigner,
    InMemoryActivationIssuanceStore,
    LicenseIssuance,
    issue_from_activation,
)


class _Protector:
    def __init__(self):
        self.cipher = AESGCM(b"h" * 32)

    def protect(self, plaintext: bytes) -> bytes:
        return b"a" * 12 + self.cipher.encrypt(b"a" * 12, plaintext, b"host-agent")

    def unprotect(self, ciphertext: bytes) -> bytes:
        return self.cipher.decrypt(ciphertext[:12], ciphertext[12:], b"host-agent")


ISSUER = Ed25519LicenseSigner(
    "issuer-test-2026-01",
    bytes.fromhex("4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb"),
)


def agent(tmp_path: Path) -> HostLicenseAgent:
    return HostLicenseAgent(
        InstallationIdentityStore(tmp_path / "state", "dental-erp", _Protector()),
        {ISSUER.key_id: ISSUER.public_key_pem()},
    )


def issue(request: str, *, installation_product: str = "dental-erp") -> str:
    return issue_from_activation(
        request,
        expected_product_id=installation_product,
        issuance=LicenseIssuance(
            customer_id="customer-sunny-smile",
            sequence=1,
            issued_at=datetime(2026, 8, 24, tzinfo=UTC),
            not_before=datetime(2026, 8, 24, tzinfo=UTC),
            expires_at=datetime(2026, 9, 24, tzinfo=UTC),
            entitlements=("core",),
            license_id="018f47a7-5b9c-7d31-8e1a-c7c77d79f430",
        ),
        signer=ISSUER,
        store=InMemoryActivationIssuanceStore(),
    )


def test_offline_request_file_round_trips_into_installed_license(tmp_path: Path) -> None:
    host = agent(tmp_path)
    request_path = tmp_path / "usb" / "activation.req"
    exported = host.export_activation_request(
        request_path,
        app_version="1.0.0",
        delivery="offline",
        now=datetime(2026, 8, 24, tzinfo=UTC),
    )
    request = request_path.read_text()
    assert verify_activation_request(request).installation_id == exported.installation_id

    decision = host.import_license_document(issue(request), now=datetime(2026, 8, 25, tzinfo=UTC))
    assert decision.state == "active"
    assert json.loads((tmp_path / "state" / "evidence.json").read_text())["highest_sequence"] == 1
    assert (tmp_path / "state" / "current.lic").exists()


def test_license_for_another_installation_is_never_written(tmp_path: Path) -> None:
    first = agent(tmp_path / "first")
    other = agent(tmp_path / "other")
    first_request_path = tmp_path / "first.req"
    first.export_activation_request(first_request_path, app_version="1.0.0", delivery="offline")
    wrong_license = issue(first_request_path.read_text())

    with pytest.raises(ValueError, match="wrong_installation"):
        other.import_license_document(wrong_license, now=datetime(2026, 8, 25, tzinfo=UTC))
    assert not (tmp_path / "other" / "state" / "current.lic").exists()


def test_tampered_license_does_not_replace_current_license(tmp_path: Path) -> None:
    host = agent(tmp_path)
    request_path = tmp_path / "activation.req"
    host.export_activation_request(request_path, app_version="1.0.0", delivery="offline")
    valid = issue(request_path.read_text())
    host.import_license_document(valid, now=datetime(2026, 8, 25, tzinfo=UTC))
    current_path = tmp_path / "state" / "current.lic"

    envelope = json.loads(valid)
    envelope["signature"] = ("A" if envelope["signature"][0] != "A" else "B") + envelope[
        "signature"
    ][1:]
    with pytest.raises(ValueError, match="invalid_signature"):
        host.import_license_document(json.dumps(envelope), now=datetime(2026, 8, 25, tzinfo=UTC))
    assert current_path.read_text() == valid


def test_only_signed_emergency_license_can_recover_corrupt_evidence(tmp_path: Path) -> None:
    host = agent(tmp_path)
    request_path = tmp_path / "activation.req"
    host.export_activation_request(request_path, app_version="1.0.0", delivery="offline")
    request = request_path.read_text()
    evidence_path = tmp_path / "state" / "evidence.json"
    evidence_path.write_text("not-json")

    with pytest.raises(ValueError, match="clock_rollback"):
        host.import_license_document(issue(request), now=datetime(2026, 8, 25, tzinfo=UTC))

    emergency = issue_from_activation(
        request,
        expected_product_id="dental-erp",
        issuance=LicenseIssuance(
            customer_id="customer-sunny-smile",
            sequence=2,
            issued_at=datetime(2026, 8, 25, tzinfo=UTC),
            not_before=datetime(2026, 8, 25, tzinfo=UTC),
            expires_at=datetime(2026, 8, 27, tzinfo=UTC),
            entitlements=("core",),
            mode="emergency",
            license_id="018f47a7-5b9c-7d31-8e1a-c7c77d79f431",
        ),
        signer=ISSUER,
        store=InMemoryActivationIssuanceStore(),
    )
    assert (
        host.import_license_document(emergency, now=datetime(2026, 8, 25, 1, tzinfo=UTC)).state
        == "recovery"
    )
    assert json.loads(evidence_path.read_text())["highest_sequence"] == 2
