import base64
import json
from datetime import UTC, datetime
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.licensing import LicenseEvidence, evaluate_license

VECTOR_PATH = Path(__file__).parents[2] / "docs" / "licensing" / "test-vectors" / "v1-valid.json"
VECTOR = json.loads(VECTOR_PATH.read_text())
LICENSE = json.dumps(VECTOR["license"])
PUBLIC_KEYS = {"test-2026-01": VECTOR["public_key_pem"]}


def signed_license(**overrides) -> str:
    header = {"alg": "EdDSA", "kid": "test-2026-01", "typ": "sunny-smile-offline-license+jws"}
    payload = {
        "schema_version": 1,
        "license_id": "018f47a7-5b9c-7d31-8e1a-c7c77d79f401",
        "customer_id": "customer-sunny-smile",
        "product_id": "dental-erp",
        "installation_id": "installation-test-01",
        "sequence": 1,
        "issued_at": "2026-08-01T00:00:00Z",
        "not_before": "2026-08-01T00:00:00Z",
        "expires_at": "2026-08-31T23:59:59Z",
        "mode": "standard",
        "grace_days": 5,
        "entitlements": ["core"],
        **overrides,
    }

    def encoded(value) -> str:
        raw = json.dumps(value, separators=(",", ":")).encode()
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

    protected_value = encoded(header)
    payload_value = encoded(payload)
    private_key = Ed25519PrivateKey.from_private_bytes(bytes.fromhex(VECTOR["private_seed_hex"]))
    signature = private_key.sign(f"{protected_value}.{payload_value}".encode("ascii"))
    return json.dumps(
        {
            "format": "sunny-smile-offline-license/v1",
            "protected": protected_value,
            "payload": payload_value,
            "signature": base64.urlsafe_b64encode(signature).rstrip(b"=").decode(),
        }
    )


def decide(at: str, **overrides):
    options = {
        "license": LICENSE,
        "product_id": "dental-erp",
        "installation_id": "installation-test-01",
        "public_keys": PUBLIC_KEYS,
        "now": datetime.fromisoformat(at.replace("Z", "+00:00")).astimezone(UTC),
    }
    options.update(overrides)
    return evaluate_license(**options)


def test_cross_language_vector_is_active() -> None:
    decision = decide("2026-08-20T12:00:00Z")
    assert decision.state == "active"
    assert decision.allows_write is True
    assert decision.next_evidence.highest_sequence == 1


def test_standard_license_has_exactly_five_days_of_grace() -> None:
    assert decide("2026-09-05T23:59:59Z").state == "grace"
    expired = decide("2026-09-06T00:00:00Z")
    assert expired.state == "expired_read_only"
    assert expired.allows_read is True
    assert expired.allows_write is False
    assert expired.allows_recovery is True


def test_wrong_installation_is_rejected() -> None:
    assert decide("2026-08-20T12:00:00Z", installation_id="another-installation").reason == (
        "wrong_installation"
    )


def test_rfc7638_installation_id_may_begin_with_base64url_symbol() -> None:
    installation_id = "-d1wGF_MqzyJJo0Amupuq94VtA-5hnOpYu1IwBPXFmk"
    document = signed_license(installation_id=installation_id)
    decision = decide(
        "2026-08-20T12:00:00Z",
        license=document,
        installation_id=installation_id,
    )
    assert decision.state == "active"


def test_wrong_product_is_rejected() -> None:
    decision = decide(
        "2026-08-20T12:00:00Z",
        product_id="clinic-cms",
        evidence=LicenseEvidence(highest_sequence=0),
    )
    assert decision.reason == "wrong_product"
    assert decision.next_evidence.highest_sequence == 0


def test_clock_rollback_is_rejected() -> None:
    evidence = LicenseEvidence(max_observed_at="2026-08-21T12:00:00Z")
    decision = decide("2026-08-20T12:00:00Z", evidence=evidence)
    assert decision.reason == "clock_rollback"
    assert decision.allows_write is False


def test_old_sequence_is_rejected() -> None:
    evidence = LicenseEvidence(
        highest_sequence=2,
        highest_sequence_license_id="018f47a7-5b9c-7d31-8e1a-c7c77d79f402",
    )
    assert decide("2026-08-20T12:00:00Z", evidence=evidence).reason == "superseded_license"


def test_tampered_payload_is_rejected() -> None:
    envelope = json.loads(LICENSE)
    envelope["payload"] = envelope["payload"][:-1] + (
        "A" if envelope["payload"][-1] != "A" else "B"
    )
    assert decide("2026-08-20T12:00:00Z", license=json.dumps(envelope)).reason in {
        "invalid_signature",
        "malformed",
    }


def test_naive_decision_time_is_rejected() -> None:
    try:
        evaluate_license(
            license=LICENSE,
            product_id="dental-erp",
            installation_id="installation-test-01",
            public_keys=PUBLIC_KEYS,
            now=datetime(2026, 8, 20, 12),
        )
    except ValueError as exc:
        assert str(exc) == "now must be timezone-aware"
    else:
        raise AssertionError("naive datetime was accepted")


def test_newer_emergency_license_recovers_clock_evidence() -> None:
    emergency = signed_license(
        license_id="018f47a7-5b9c-7d31-8e1a-c7c77d79f403",
        sequence=3,
        issued_at="2026-08-20T00:00:00Z",
        not_before="2026-08-20T00:00:00Z",
        mode="emergency",
        grace_days=0,
        expires_at="2026-08-21T00:00:00Z",
    )
    evidence = LicenseEvidence(
        max_observed_at="2026-09-20T12:00:00Z",
        highest_sequence=2,
        highest_sequence_license_id="018f47a7-5b9c-7d31-8e1a-c7c77d79f402",
    )
    decision = decide("2026-08-20T12:00:00Z", license=emergency, evidence=evidence)
    assert decision.state == "recovery"
    assert decision.next_evidence.max_observed_at == "2026-08-20T12:00:00Z"
    assert decision.next_evidence.highest_sequence == 3


def test_emergency_license_cannot_exceed_72_hours() -> None:
    emergency = signed_license(
        mode="emergency",
        grace_days=0,
        expires_at="2026-08-05T00:00:01Z",
    )
    assert decide("2026-08-02T00:00:00Z", license=emergency).reason == "malformed"
