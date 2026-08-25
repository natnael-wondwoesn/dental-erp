import base64
import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.licensing.activation import (
    create_activation_request,
    generate_installation_identity,
    verify_activation_request,
)

SEED = bytes.fromhex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")
VECTOR_PATH = (
    Path(__file__).parents[2] / "docs" / "licensing" / "test-vectors" / "v1-activation-request.json"
)


def request(delivery="offline"):
    return create_activation_request(
        generate_installation_identity(SEED),
        product_id="dental-erp",
        app_version="1.0.0",
        delivery=delivery,
        now=datetime(2026, 8, 24, tzinfo=UTC),
        request_id="018f47a7-5b9c-7d31-8e1a-c7c77d79f410",
        nonce=b"n" * 24,
    )


def test_online_and_offline_use_same_verified_format() -> None:
    assert verify_activation_request(request("online")).delivery == "online"
    assert verify_activation_request(request("offline")).delivery == "offline"


def test_python_verifies_shared_cross_language_vector() -> None:
    vector = json.loads(VECTOR_PATH.read_text())
    payload = verify_activation_request(json.dumps(vector["request"]))
    assert payload.installation_id == vector["installation_id"]


def test_identity_is_stable_for_same_seed_and_different_for_another() -> None:
    first = generate_installation_identity(SEED)
    assert generate_installation_identity(SEED).installation_id == first.installation_id
    assert generate_installation_identity(b"x" * 32).installation_id != first.installation_id


def test_request_contains_no_private_key_or_patient_data() -> None:
    raw = request()
    assert SEED.hex() not in raw
    assert "patient" not in raw.lower()
    assert "private" not in raw.lower()


def test_tampering_is_rejected() -> None:
    envelope = json.loads(request())
    envelope["payload"] = envelope["payload"][:-1] + (
        "A" if envelope["payload"][-1] != "A" else "B"
    )
    with pytest.raises(ValueError):
        verify_activation_request(json.dumps(envelope))


def test_invalid_seed_length_is_rejected() -> None:
    with pytest.raises(ValueError, match="32 bytes"):
        generate_installation_identity(b"short")


def test_creation_rejects_naive_time_and_short_nonce() -> None:
    identity = generate_installation_identity(SEED)
    with pytest.raises(ValueError, match="timezone-aware"):
        create_activation_request(
            identity,
            product_id="dental-erp",
            app_version="1.0.0",
            delivery="offline",
            now=datetime(2026, 8, 24),
        )
    with pytest.raises(ValueError, match="24 bytes"):
        create_activation_request(
            identity,
            product_id="dental-erp",
            app_version="1.0.0",
            delivery="offline",
            nonce=b"short",
        )


def test_unknown_payload_fields_are_rejected() -> None:
    envelope = json.loads(request())
    payload = json.loads(base64.urlsafe_b64decode(envelope["payload"] + "=="))
    payload["patient_name"] = "must not be accepted"
    envelope["payload"] = (
        base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode())
        .rstrip(b"=")
        .decode()
    )
    with pytest.raises(ValueError, match="payload fields"):
        verify_activation_request(json.dumps(envelope))
