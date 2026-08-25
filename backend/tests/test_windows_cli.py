import io
import json
from datetime import UTC, datetime
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.licensing.activation import verify_activation_request
from app.licensing.issuer import (
    Ed25519LicenseSigner,
    InMemoryActivationIssuanceStore,
    LicenseIssuance,
    issue_from_activation,
)
from app.licensing.windows_cli import run


class _Protector:
    def __init__(self):
        self.cipher = AESGCM(b"c" * 32)

    def protect(self, plaintext: bytes) -> bytes:
        return b"c" * 12 + self.cipher.encrypt(b"c" * 12, plaintext, b"cli")

    def unprotect(self, ciphertext: bytes) -> bytes:
        return self.cipher.decrypt(ciphertext[:12], ciphertext[12:], b"cli")


NOW = datetime(2026, 8, 24, tzinfo=UTC)
ISSUER = Ed25519LicenseSigner(
    "issuer-test-2026-01",
    bytes.fromhex("4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb"),
)


def invoke(arguments: list[str], protector: _Protector, keys=None):
    output = io.StringIO()
    code = run(
        arguments,
        protector=protector,
        public_keys=keys or {},
        now=NOW,
        output=output,
    )
    return code, json.loads(output.getvalue())


def test_init_is_stable_and_outputs_no_private_material(tmp_path: Path) -> None:
    arguments = ["--product-id", "dental-erp", "--state-dir", str(tmp_path), "init"]
    first = invoke(arguments, _Protector())[1]
    second = invoke(arguments, _Protector())[1]
    assert second == first
    assert first["status"] == "ready"
    assert "private" not in json.dumps(first).lower()


def test_request_and_install_commands_complete_offline_exchange(tmp_path: Path) -> None:
    protector = _Protector()
    request_path = tmp_path / "usb" / "clinic.req"
    code, created = invoke(
        [
            "--product-id",
            "dental-erp",
            "--state-dir",
            str(tmp_path / "state"),
            "request",
            "--app-version",
            "1.0.0",
            "--delivery",
            "offline",
            "--output",
            str(request_path),
        ],
        protector,
    )
    assert code == 0 and created["status"] == "request_created"
    request = request_path.read_text()
    assert verify_activation_request(request).delivery == "offline"

    license_document = issue_from_activation(
        request,
        expected_product_id="dental-erp",
        issuance=LicenseIssuance(
            customer_id="customer-sunny-smile",
            sequence=1,
            issued_at=NOW,
            not_before=NOW,
            expires_at=datetime(2026, 9, 24, tzinfo=UTC),
            entitlements=("core",),
            license_id="018f47a7-5b9c-7d31-8e1a-c7c77d79f440",
        ),
        signer=ISSUER,
        store=InMemoryActivationIssuanceStore(),
    )
    license_path = tmp_path / "usb" / "clinic.lic"
    license_path.write_text(license_document)
    code, installed = invoke(
        [
            "--product-id",
            "dental-erp",
            "--state-dir",
            str(tmp_path / "state"),
            "install-license",
            "--input",
            str(license_path),
        ],
        protector,
        {ISSUER.key_id: ISSUER.public_key_pem()},
    )
    assert code == 0
    assert installed == {
        "status": "license_installed",
        "state": "active",
        "expires_at": "2026-09-24T00:00:00Z",
    }
