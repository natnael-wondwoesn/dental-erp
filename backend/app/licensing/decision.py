"""Local, product-agnostic decisions for signed offline licenses."""

from __future__ import annotations

import base64
import binascii
import json
import re
from collections.abc import Mapping
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

LICENSE_FORMAT = "sunny-smile-offline-license/v1"
LICENSE_TYPE = "sunny-smile-offline-license+jws"
STANDARD_GRACE_DAYS = 5
DEFAULT_CLOCK_ROLLBACK_TOLERANCE = timedelta(minutes=5)

LicenseState = Literal["active", "grace", "expired_read_only", "invalid", "recovery"]
LicenseReason = Literal[
    "ok",
    "within_grace",
    "expired",
    "malformed",
    "unsupported_format",
    "unknown_signing_key",
    "invalid_signature",
    "wrong_product",
    "wrong_installation",
    "not_yet_valid",
    "clock_rollback",
    "superseded_license",
    "sequence_conflict",
]
LicenseMode = Literal["standard", "emergency"]

UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
INSTALLATION_ID_PATTERN = re.compile(
    r"^(?:[A-Za-z0-9][A-Za-z0-9._:-]{0,127}|[A-Za-z0-9_-]{43})$"
)
BASE64URL_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")
UTC_TIMESTAMP_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$")


@dataclass(frozen=True, slots=True)
class LicensePayload:
    schema_version: Literal[1]
    license_id: str
    customer_id: str
    product_id: str
    installation_id: str
    sequence: int
    issued_at: str
    not_before: str
    expires_at: str
    mode: LicenseMode
    grace_days: int
    entitlements: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class LicenseEvidence:
    max_observed_at: str | None = None
    highest_sequence: int | None = None
    highest_sequence_license_id: str | None = None


@dataclass(frozen=True, slots=True)
class LicenseDecision:
    state: LicenseState
    reason: LicenseReason
    payload: LicensePayload | None
    allows_read: bool
    allows_write: bool
    allows_recovery: Literal[True]
    next_evidence: LicenseEvidence


@dataclass(frozen=True, slots=True)
class _Envelope:
    protected: str
    payload: str
    signature: str


def _decode_base64url(value: Any) -> bytes:
    if not isinstance(value, str) or not BASE64URL_PATTERN.fullmatch(value):
        raise ValueError("Invalid base64url")
    try:
        decoded = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except (ValueError, binascii.Error) as exc:
        raise ValueError("Invalid base64url") from exc
    canonical = base64.urlsafe_b64encode(decoded).rstrip(b"=").decode("ascii")
    if canonical != value:
        raise ValueError("Non-canonical base64url")
    return decoded


def _json_object(encoded: str) -> dict[str, Any]:
    value = json.loads(_decode_base64url(encoded).decode("utf-8"))
    if not isinstance(value, dict):
        raise ValueError("Expected object")
    return value


def _timestamp(value: Any) -> datetime:
    if not isinstance(value, str) or not UTC_TIMESTAMP_PATTERN.fullmatch(value):
        raise ValueError("Invalid UTC timestamp")
    parsed = datetime.fromisoformat(value.removesuffix("Z") + "+00:00")
    return parsed.astimezone(UTC)


def _parse_envelope(raw_license: str | Mapping[str, Any]) -> _Envelope:
    value: Any = json.loads(raw_license) if isinstance(raw_license, str) else raw_license
    if not isinstance(value, Mapping):
        raise ValueError("Expected envelope")
    if value.get("format") != LICENSE_FORMAT:
        raise LookupError("Unsupported format")
    protected = value.get("protected")
    payload = value.get("payload")
    signature = value.get("signature")
    _decode_base64url(protected)
    _decode_base64url(payload)
    _decode_base64url(signature)
    return _Envelope(protected=protected, payload=payload, signature=signature)


def _parse_header(envelope: _Envelope) -> str:
    value = _json_object(envelope.protected)
    if (
        value.get("alg") != "EdDSA"
        or value.get("typ") != LICENSE_TYPE
        or not isinstance(value.get("kid"), str)
        or not ID_PATTERN.fullmatch(value["kid"])
        or "crit" in value
    ):
        raise ValueError("Invalid protected header")
    return value["kid"]


def _identifier(value: Any) -> str:
    if not isinstance(value, str) or not ID_PATTERN.fullmatch(value):
        raise ValueError("Invalid identifier")
    return value


def _installation_identifier(value: Any) -> str:
    if not isinstance(value, str) or not INSTALLATION_ID_PATTERN.fullmatch(value):
        raise ValueError("Invalid installation identifier")
    return value


def _parse_payload(envelope: _Envelope) -> tuple[LicensePayload, datetime, datetime, datetime]:
    value = _json_object(envelope.payload)
    if value.get("schema_version") != 1:
        raise ValueError("Unsupported schema")
    license_id = value.get("license_id")
    if not isinstance(license_id, str) or not UUID_PATTERN.fullmatch(license_id):
        raise ValueError("Invalid license identifier")
    sequence = value.get("sequence")
    if not isinstance(sequence, int) or isinstance(sequence, bool) or sequence < 1:
        raise ValueError("Invalid sequence")
    mode = value.get("mode")
    if mode not in ("standard", "emergency"):
        raise ValueError("Invalid mode")
    grace_days = value.get("grace_days")
    if (mode == "standard" and grace_days != STANDARD_GRACE_DAYS) or (
        mode == "emergency" and grace_days != 0
    ):
        raise ValueError("Invalid grace policy")
    raw_entitlements = value.get("entitlements")
    if not isinstance(raw_entitlements, list):
        raise ValueError("Invalid entitlements")
    entitlements = tuple(_identifier(entry) for entry in raw_entitlements)
    if len(set(entitlements)) != len(entitlements):
        raise ValueError("Duplicate entitlements")

    issued_at = _timestamp(value.get("issued_at"))
    not_before = _timestamp(value.get("not_before"))
    expires_at = _timestamp(value.get("expires_at"))
    if issued_at > not_before or not_before >= expires_at:
        raise ValueError("Invalid validity window")
    if mode == "emergency" and expires_at - not_before > timedelta(hours=72):
        raise ValueError("Emergency license exceeds 72 hours")

    payload = LicensePayload(
        schema_version=1,
        license_id=license_id,
        customer_id=_identifier(value.get("customer_id")),
        product_id=_identifier(value.get("product_id")),
        installation_id=_installation_identifier(value.get("installation_id")),
        sequence=sequence,
        issued_at=value["issued_at"],
        not_before=value["not_before"],
        expires_at=value["expires_at"],
        mode=mode,
        grace_days=grace_days,
        entitlements=entitlements,
    )
    return payload, issued_at, not_before, expires_at


def _safe_evidence(evidence: LicenseEvidence, now: datetime) -> LicenseEvidence:
    try:
        previous = _timestamp(evidence.max_observed_at) if evidence.max_observed_at else None
    except ValueError:
        previous = now
    maximum = max(now, previous) if previous else now
    return replace(evidence, max_observed_at=maximum.isoformat().replace("+00:00", "Z"))


def _next_evidence(
    evidence: LicenseEvidence, now: datetime, payload: LicensePayload | None = None
) -> LicenseEvidence:
    updated = _safe_evidence(evidence, now)
    current_sequence = evidence.highest_sequence or 0
    if payload is None or payload.sequence < current_sequence:
        return updated
    return LicenseEvidence(
        max_observed_at=updated.max_observed_at,
        highest_sequence=payload.sequence,
        highest_sequence_license_id=payload.license_id,
    )


def _invalid(
    reason: LicenseReason, evidence: LicenseEvidence, payload: LicensePayload | None = None
) -> LicenseDecision:
    return LicenseDecision(
        state="invalid",
        reason=reason,
        payload=payload,
        allows_read=True,
        allows_write=False,
        allows_recovery=True,
        next_evidence=evidence,
    )


def evaluate_license(
    *,
    license: str | Mapping[str, Any],
    product_id: str,
    installation_id: str,
    public_keys: Mapping[str, str],
    now: datetime,
    evidence: LicenseEvidence | None = None,
    clock_rollback_tolerance: timedelta = DEFAULT_CLOCK_ROLLBACK_TOLERANCE,
) -> LicenseDecision:
    """Verify a signed license and return the complete local enforcement decision."""

    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    now = now.astimezone(UTC)
    evidence = evidence or LicenseEvidence()
    baseline = _next_evidence(evidence, now)

    try:
        envelope = _parse_envelope(license)
    except LookupError:
        return _invalid("unsupported_format", baseline)
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError):
        return _invalid("malformed", baseline)

    try:
        key_id = _parse_header(envelope)
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError):
        return _invalid("malformed", baseline)
    public_key_pem = public_keys.get(key_id)
    if public_key_pem is None:
        return _invalid("unknown_signing_key", baseline)

    try:
        public_key = serialization.load_pem_public_key(public_key_pem.encode("ascii"))
        if not isinstance(public_key, Ed25519PublicKey):
            raise ValueError("Expected Ed25519 key")
        public_key.verify(
            _decode_base64url(envelope.signature),
            f"{envelope.protected}.{envelope.payload}".encode("ascii"),
        )
    except InvalidSignature:
        return _invalid("invalid_signature", baseline)
    except (ValueError, TypeError, binascii.Error):
        return _invalid("malformed", baseline)

    try:
        payload, _issued_at, not_before, expires_at = _parse_payload(envelope)
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError):
        return _invalid("malformed", baseline)
    if payload.product_id != product_id:
        return _invalid("wrong_product", baseline, payload)
    if payload.installation_id != installation_id:
        return _invalid("wrong_installation", baseline, payload)

    highest_sequence = evidence.highest_sequence or 0
    clock_rollback = False
    try:
        max_observed = _timestamp(evidence.max_observed_at) if evidence.max_observed_at else None
    except ValueError:
        max_observed = None
        clock_rollback = True
    if max_observed and now + clock_rollback_tolerance < max_observed:
        clock_rollback = True
    can_recover_clock = payload.mode == "emergency" and payload.sequence > highest_sequence
    if clock_rollback and not can_recover_clock:
        return _invalid("clock_rollback", baseline, payload)

    if payload.sequence < highest_sequence:
        return _invalid("superseded_license", baseline, payload)
    if (
        payload.sequence == highest_sequence
        and evidence.highest_sequence_license_id
        and payload.license_id != evidence.highest_sequence_license_id
    ):
        return _invalid("sequence_conflict", baseline, payload)
    if now < not_before:
        return _invalid("not_yet_valid", baseline, payload)

    updated = (
        LicenseEvidence(
            max_observed_at=now.isoformat().replace("+00:00", "Z"),
            highest_sequence=payload.sequence,
            highest_sequence_license_id=payload.license_id,
        )
        if clock_rollback
        else _next_evidence(evidence, now, payload)
    )

    if now <= expires_at:
        return LicenseDecision(
            state="recovery" if payload.mode == "emergency" else "active",
            reason="ok",
            payload=payload,
            allows_read=True,
            allows_write=True,
            allows_recovery=True,
            next_evidence=updated,
        )

    grace_ends = expires_at + timedelta(days=payload.grace_days)
    if payload.mode == "standard" and now <= grace_ends:
        return LicenseDecision(
            state="grace",
            reason="within_grace",
            payload=payload,
            allows_read=True,
            allows_write=True,
            allows_recovery=True,
            next_evidence=updated,
        )
    return LicenseDecision(
        state="expired_read_only",
        reason="expired",
        payload=payload,
        allows_read=True,
        allows_write=False,
        allows_recovery=True,
        next_evidence=updated,
    )
