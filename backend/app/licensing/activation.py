import base64
import hashlib
import json
import re
import secrets
import uuid
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Literal

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

ACTIVATION_FORMAT = "sunny-smile-activation-request/v1"
ACTIVATION_TYPE = "sunny-smile-activation-request+jws"
ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
UTC_TIMESTAMP_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$")
PAYLOAD_FIELDS = {
    "schema_version",
    "request_id",
    "product_id",
    "installation_id",
    "installation_public_key",
    "created_at",
    "nonce",
    "app_version",
    "platform",
    "delivery",
}


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(value: str) -> bytes:
    if not value or any(
        character not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
        for character in value
    ):
        raise ValueError("Invalid base64url")
    decoded = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    if _b64(decoded) != value:
        raise ValueError("Non-canonical base64url")
    return decoded


def _canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


@dataclass(frozen=True, slots=True)
class InstallationIdentity:
    private_seed: bytes
    installation_id: str
    public_jwk: dict[str, str]


@dataclass(frozen=True, slots=True)
class ActivationRequestPayload:
    schema_version: Literal[1]
    request_id: str
    product_id: str
    installation_id: str
    installation_public_key: dict[str, str]
    created_at: str
    nonce: str
    app_version: str
    platform: Literal["windows"]
    delivery: Literal["online", "offline"]


def installation_id_for(public_jwk: dict[str, str]) -> str:
    if (
        set(public_jwk) != {"crv", "kty", "x"}
        or public_jwk.get("crv") != "Ed25519"
        or public_jwk.get("kty") != "OKP"
    ):
        raise ValueError("Invalid installation public key")
    if len(_unb64(public_jwk["x"])) != 32:
        raise ValueError("Invalid Ed25519 public key")
    return _b64(hashlib.sha256(_canonical(public_jwk)).digest())


def generate_installation_identity(seed: bytes | None = None) -> InstallationIdentity:
    seed = seed or secrets.token_bytes(32)
    if len(seed) != 32:
        raise ValueError("Ed25519 seed must be 32 bytes")
    private_key = Ed25519PrivateKey.from_private_bytes(seed)
    public_bytes = private_key.public_key().public_bytes_raw()
    public_jwk = {"crv": "Ed25519", "kty": "OKP", "x": _b64(public_bytes)}
    return InstallationIdentity(seed, installation_id_for(public_jwk), public_jwk)


def create_activation_request(
    identity: InstallationIdentity,
    *,
    product_id: str,
    app_version: str,
    delivery: Literal["online", "offline"],
    now: datetime | None = None,
    request_id: str | None = None,
    nonce: bytes | None = None,
) -> str:
    now = now or datetime.now(UTC)
    if now.tzinfo is None:
        raise ValueError("Activation time must be timezone-aware")
    now = now.astimezone(UTC)
    if not ID_PATTERN.fullmatch(product_id) or not ID_PATTERN.fullmatch(app_version):
        raise ValueError("Invalid product or application version")
    if delivery not in {"online", "offline"}:
        raise ValueError("Invalid activation delivery")
    request_id = request_id or str(uuid.uuid4())
    if str(uuid.UUID(request_id)) != request_id:
        raise ValueError("Invalid activation request identifier")
    nonce = nonce or secrets.token_bytes(24)
    if len(nonce) != 24:
        raise ValueError("Activation nonce must be 24 bytes")
    payload = ActivationRequestPayload(
        schema_version=1,
        request_id=request_id,
        product_id=product_id,
        installation_id=identity.installation_id,
        installation_public_key=identity.public_jwk,
        created_at=now.isoformat().replace("+00:00", "Z"),
        nonce=_b64(nonce),
        app_version=app_version,
        platform="windows",
        delivery=delivery,
    )
    protected = _b64(
        _canonical({"alg": "EdDSA", "kid": identity.installation_id, "typ": ACTIVATION_TYPE})
    )
    encoded_payload = _b64(_canonical(asdict(payload)))
    signature = Ed25519PrivateKey.from_private_bytes(identity.private_seed).sign(
        f"{protected}.{encoded_payload}".encode("ascii")
    )
    return json.dumps(
        {
            "format": ACTIVATION_FORMAT,
            "protected": protected,
            "payload": encoded_payload,
            "signature": _b64(signature),
        },
        separators=(",", ":"),
    )


def verify_activation_request(raw: str) -> ActivationRequestPayload:
    try:
        envelope = json.loads(raw)
        if not isinstance(envelope, dict) or set(envelope) != {
            "format",
            "protected",
            "payload",
            "signature",
        }:
            raise ValueError("Invalid activation envelope")
        if envelope["format"] != ACTIVATION_FORMAT:
            raise ValueError("Unsupported activation request")
        header = json.loads(_unb64(envelope["protected"]))
        payload_value = json.loads(_unb64(envelope["payload"]))
        if not isinstance(payload_value, dict) or set(payload_value) != PAYLOAD_FIELDS:
            raise ValueError("Invalid activation payload fields")
        payload = ActivationRequestPayload(**payload_value)
        if header != {"alg": "EdDSA", "kid": payload.installation_id, "typ": ACTIVATION_TYPE}:
            raise ValueError("Invalid activation header")
        if (
            payload.schema_version != 1
            or payload.platform != "windows"
            or payload.delivery not in {"online", "offline"}
            or not isinstance(payload.product_id, str)
            or not ID_PATTERN.fullmatch(payload.product_id)
            or not isinstance(payload.app_version, str)
            or not ID_PATTERN.fullmatch(payload.app_version)
            or not isinstance(payload.created_at, str)
            or not UTC_TIMESTAMP_PATTERN.fullmatch(payload.created_at)
        ):
            raise ValueError("Invalid activation payload")
        datetime.fromisoformat(payload.created_at.removesuffix("Z") + "+00:00")
        if (
            not isinstance(payload.request_id, str)
            or str(uuid.UUID(payload.request_id)) != payload.request_id
            or not isinstance(payload.nonce, str)
            or len(_unb64(payload.nonce)) != 24
        ):
            raise ValueError("Invalid activation uniqueness")
        if installation_id_for(payload.installation_public_key) != payload.installation_id:
            raise ValueError("Installation identity mismatch")
        public_key = Ed25519PublicKey.from_public_bytes(
            _unb64(payload.installation_public_key["x"])
        )
        public_key.verify(
            _unb64(envelope["signature"]),
            f"{envelope['protected']}.{envelope['payload']}".encode("ascii"),
        )
        return payload
    except (KeyError, TypeError, json.JSONDecodeError, InvalidSignature) as exc:
        raise ValueError("Invalid activation request") from exc
