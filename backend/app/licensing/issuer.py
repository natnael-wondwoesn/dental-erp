"""Issuer-only license creation and idempotent activation exchange."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import sqlite3
import threading
import uuid
from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Literal, Protocol

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.licensing.activation import ID_PATTERN, ActivationRequestPayload, verify_activation_request
from app.licensing.decision import LICENSE_FORMAT, LICENSE_TYPE, STANDARD_GRACE_DAYS


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


class LicenseSigner(Protocol):
    @property
    def key_id(self) -> str: ...

    def sign(self, message: bytes) -> bytes: ...


class Ed25519LicenseSigner:
    """Local adapter for tests; production replaces it with managed key custody."""

    def __init__(self, key_id: str, private_seed: bytes):
        if not ID_PATTERN.fullmatch(key_id) or len(private_seed) != 32:
            raise ValueError("Invalid signer configuration")
        self._key_id = key_id
        self._private_key = Ed25519PrivateKey.from_private_bytes(private_seed)

    @property
    def key_id(self) -> str:
        return self._key_id

    def sign(self, message: bytes) -> bytes:
        return self._private_key.sign(message)

    def public_key_pem(self) -> str:
        return (
            self._private_key.public_key()
            .public_bytes(
                serialization.Encoding.PEM,
                serialization.PublicFormat.SubjectPublicKeyInfo,
            )
            .decode("ascii")
        )


@dataclass(frozen=True, slots=True)
class LicenseIssuance:
    customer_id: str
    sequence: int
    issued_at: datetime
    not_before: datetime
    expires_at: datetime
    entitlements: tuple[str, ...]
    mode: Literal["standard", "emergency"] = "standard"
    license_id: str | None = None


@dataclass(frozen=True, slots=True)
class IssuedActivation:
    request_id: str
    nonce: str
    installation_id: str
    request_fingerprint: str
    license_document: str


class ActivationIssuanceStore(Protocol):
    def issue_once(
        self,
        request: ActivationRequestPayload,
        factory: Callable[[], str],
    ) -> str: ...


class InMemoryActivationIssuanceStore:
    """Thread-safe idempotency adapter for tests and local portal development."""

    def __init__(self) -> None:
        self._by_request: dict[str, IssuedActivation] = {}
        self._nonce_owner: dict[str, str] = {}
        self._lock = threading.Lock()

    def issue_once(
        self,
        request: ActivationRequestPayload,
        factory: Callable[[], str],
    ) -> str:
        fingerprint = _request_fingerprint(request)
        with self._lock:
            previous = self._by_request.get(request.request_id)
            if previous:
                if previous.request_fingerprint != fingerprint:
                    raise ValueError("Activation request identifier conflict")
                return previous.license_document
            nonce_owner = self._nonce_owner.get(request.nonce)
            if nonce_owner is not None and nonce_owner != request.request_id:
                raise ValueError("Activation nonce has already been used")
            document = factory()
            self._by_request[request.request_id] = IssuedActivation(
                request_id=request.request_id,
                nonce=request.nonce,
                installation_id=request.installation_id,
                request_fingerprint=fingerprint,
                license_document=document,
            )
            self._nonce_owner[request.nonce] = request.request_id
            return document


def _request_fingerprint(request: ActivationRequestPayload) -> str:
    return hashlib.sha256(_canonical(asdict(request))).hexdigest()


class SqliteActivationIssuanceStore:
    """Durable, process-safe idempotency store for a small license portal."""

    def __init__(self, database_path: Path, *, timeout_seconds: float = 30.0):
        self.database_path = database_path
        self.timeout_seconds = timeout_seconds
        database_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS activation_issuances (
                    request_id TEXT PRIMARY KEY,
                    nonce TEXT NOT NULL UNIQUE,
                    installation_id TEXT NOT NULL,
                    request_fingerprint TEXT NOT NULL,
                    license_document TEXT NOT NULL
                )
                """
            )
        if os.name != "nt":
            os.chmod(database_path, 0o600)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(
            self.database_path,
            timeout=self.timeout_seconds,
            isolation_level=None,
        )
        connection.execute(f"PRAGMA busy_timeout = {int(self.timeout_seconds * 1000)}")
        return connection

    def issue_once(
        self,
        request: ActivationRequestPayload,
        factory: Callable[[], str],
    ) -> str:
        fingerprint = _request_fingerprint(request)
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                previous = connection.execute(
                    """
                    SELECT request_fingerprint, license_document
                    FROM activation_issuances
                    WHERE request_id = ?
                    """,
                    (request.request_id,),
                ).fetchone()
                if previous:
                    if previous[0] != fingerprint:
                        raise ValueError("Activation request identifier conflict")
                    connection.commit()
                    return str(previous[1])
                nonce_owner = connection.execute(
                    "SELECT request_id FROM activation_issuances WHERE nonce = ?",
                    (request.nonce,),
                ).fetchone()
                if nonce_owner:
                    raise ValueError("Activation nonce has already been used")
                document = factory()
                connection.execute(
                    """
                    INSERT INTO activation_issuances (
                        request_id,
                        nonce,
                        installation_id,
                        request_fingerprint,
                        license_document
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        request.request_id,
                        request.nonce,
                        request.installation_id,
                        fingerprint,
                        document,
                    ),
                )
                connection.commit()
                return document
            except BaseException:
                connection.rollback()
                raise


def _utc(value: datetime, name: str) -> datetime:
    if value.tzinfo is None:
        raise ValueError(f"{name} must be timezone-aware")
    return value.astimezone(UTC)


def create_license_document(
    request: ActivationRequestPayload,
    issuance: LicenseIssuance,
    signer: LicenseSigner,
) -> str:
    issued_at = _utc(issuance.issued_at, "issued_at")
    not_before = _utc(issuance.not_before, "not_before")
    expires_at = _utc(issuance.expires_at, "expires_at")
    if issued_at > not_before or not_before >= expires_at:
        raise ValueError("Invalid license validity window")
    if (
        not isinstance(issuance.sequence, int)
        or isinstance(issuance.sequence, bool)
        or issuance.sequence < 1
        or issuance.mode not in {"standard", "emergency"}
        or not ID_PATTERN.fullmatch(issuance.customer_id)
        or not issuance.entitlements
        or any(not ID_PATTERN.fullmatch(value) for value in issuance.entitlements)
        or len(set(issuance.entitlements)) != len(issuance.entitlements)
    ):
        raise ValueError("Invalid license sequence or entitlements")
    if issuance.mode == "emergency" and expires_at - not_before > timedelta(hours=72):
        raise ValueError("Emergency license exceeds 72 hours")
    license_id = issuance.license_id or str(uuid.uuid4())
    uuid.UUID(license_id)
    grace_days = STANDARD_GRACE_DAYS if issuance.mode == "standard" else 0
    payload = {
        "schema_version": 1,
        "license_id": license_id,
        "customer_id": issuance.customer_id,
        "product_id": request.product_id,
        "installation_id": request.installation_id,
        "sequence": issuance.sequence,
        "issued_at": issued_at.isoformat().replace("+00:00", "Z"),
        "not_before": not_before.isoformat().replace("+00:00", "Z"),
        "expires_at": expires_at.isoformat().replace("+00:00", "Z"),
        "mode": issuance.mode,
        "grace_days": grace_days,
        "entitlements": list(issuance.entitlements),
    }
    protected = _b64(_canonical({"alg": "EdDSA", "kid": signer.key_id, "typ": LICENSE_TYPE}))
    encoded_payload = _b64(_canonical(payload))
    signature = signer.sign(f"{protected}.{encoded_payload}".encode("ascii"))
    return json.dumps(
        {
            "format": LICENSE_FORMAT,
            "protected": protected,
            "payload": encoded_payload,
            "signature": _b64(signature),
        },
        separators=(",", ":"),
    )


def issue_from_activation(
    raw_request: str,
    *,
    expected_product_id: str,
    issuance: LicenseIssuance,
    signer: LicenseSigner,
    store: ActivationIssuanceStore,
) -> str:
    request = verify_activation_request(raw_request)
    if request.product_id != expected_product_id:
        raise ValueError("Activation request belongs to another product")
    return store.issue_once(
        request,
        lambda: create_license_document(request, issuance, signer),
    )
