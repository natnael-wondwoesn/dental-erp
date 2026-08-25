from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock

import pytest

from app.licensing.activation import create_activation_request, generate_installation_identity
from app.licensing.decision import evaluate_license
from app.licensing.issuer import (
    Ed25519LicenseSigner,
    InMemoryActivationIssuanceStore,
    LicenseIssuance,
    SqliteActivationIssuanceStore,
    issue_from_activation,
)
from tests.test_activation_request import SEED, request

ISSUER_SEED = bytes.fromhex("4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb")
ISSUER = Ed25519LicenseSigner("issuer-test-2026-01", ISSUER_SEED)


def issuance(**overrides) -> LicenseIssuance:
    values = {
        "customer_id": "customer-sunny-smile",
        "sequence": 1,
        "issued_at": datetime(2026, 8, 24, tzinfo=UTC),
        "not_before": datetime(2026, 8, 24, tzinfo=UTC),
        "expires_at": datetime(2026, 9, 24, tzinfo=UTC),
        "entitlements": ("core",),
        "license_id": "018f47a7-5b9c-7d31-8e1a-c7c77d79f420",
    }
    values.update(overrides)
    return LicenseIssuance(**values)


def public_key_pem() -> str:
    return ISSUER.public_key_pem()


def distinct_request(*, request_id: str, nonce: bytes, delivery="offline") -> str:
    return create_activation_request(
        generate_installation_identity(SEED),
        product_id="dental-erp",
        app_version="1.0.0",
        delivery=delivery,
        now=datetime(2026, 8, 24, tzinfo=UTC),
        request_id=request_id,
        nonce=nonce,
    )


def test_issued_license_is_bound_and_verifiable() -> None:
    document = issue_from_activation(
        request(),
        expected_product_id="dental-erp",
        issuance=issuance(),
        signer=ISSUER,
        store=InMemoryActivationIssuanceStore(),
    )
    decision = evaluate_license(
        license=document,
        product_id="dental-erp",
        installation_id="kPrK_qmxVWaYVA9wwBF6Iuo3vVzz7TxHCTwXBygrS4k",
        public_keys={"issuer-test-2026-01": public_key_pem()},
        now=datetime(2026, 8, 25, tzinfo=UTC),
    )
    assert decision.state == "active"
    assert decision.payload and decision.payload.grace_days == 5


def test_exact_retry_returns_identical_license() -> None:
    store = InMemoryActivationIssuanceStore()
    first = issue_from_activation(
        request(), expected_product_id="dental-erp", issuance=issuance(), signer=ISSUER, store=store
    )
    second = issue_from_activation(
        request(),
        expected_product_id="dental-erp",
        issuance=issuance(sequence=99),
        signer=ISSUER,
        store=store,
    )
    assert second == first


def test_concurrent_retry_signs_once_and_returns_one_document() -> None:
    store = InMemoryActivationIssuanceStore()

    class CountingSigner:
        key_id = ISSUER.key_id
        calls = 0

        def sign(self, message: bytes) -> bytes:
            self.calls += 1
            return ISSUER.sign(message)

    signer = CountingSigner()

    def attempt(_: int) -> str:
        return issue_from_activation(
            request(),
            expected_product_id="dental-erp",
            issuance=issuance(),
            signer=signer,
            store=store,
        )

    with ThreadPoolExecutor(max_workers=16) as executor:
        documents = list(executor.map(attempt, range(64)))
    assert len(set(documents)) == 1
    assert signer.calls == 1


def test_signer_failure_does_not_consume_request() -> None:
    class FailingSigner:
        key_id = "failing"

        def sign(self, _message: bytes) -> bytes:
            raise RuntimeError("signer unavailable")

    store = InMemoryActivationIssuanceStore()
    with pytest.raises(RuntimeError, match="unavailable"):
        issue_from_activation(
            request(),
            expected_product_id="dental-erp",
            issuance=issuance(),
            signer=FailingSigner(),
            store=store,
        )
    assert issue_from_activation(
        request(), expected_product_id="dental-erp", issuance=issuance(), signer=ISSUER, store=store
    )


def test_sqlite_retry_survives_portal_restart(tmp_path: Path) -> None:
    database = tmp_path / "issuer" / "licenses.sqlite3"
    first = issue_from_activation(
        request(),
        expected_product_id="dental-erp",
        issuance=issuance(),
        signer=ISSUER,
        store=SqliteActivationIssuanceStore(database),
    )
    second = issue_from_activation(
        request(),
        expected_product_id="dental-erp",
        issuance=issuance(sequence=99),
        signer=ISSUER,
        store=SqliteActivationIssuanceStore(database),
    )
    assert second == first
    assert database.stat().st_mode & 0o077 == 0


def test_sqlite_concurrent_retries_across_connections_sign_once(tmp_path: Path) -> None:
    database = tmp_path / "licenses.sqlite3"
    signer_lock = Lock()

    class CountingSigner:
        key_id = ISSUER.key_id
        calls = 0

        def sign(self, message: bytes) -> bytes:
            with signer_lock:
                self.calls += 1
            return ISSUER.sign(message)

    signer = CountingSigner()

    def attempt(_: int) -> str:
        return issue_from_activation(
            request(),
            expected_product_id="dental-erp",
            issuance=issuance(),
            signer=signer,
            store=SqliteActivationIssuanceStore(database),
        )

    with ThreadPoolExecutor(max_workers=16) as executor:
        documents = list(executor.map(attempt, range(64)))
    assert len(set(documents)) == 1
    assert signer.calls == 1


def test_sqlite_signer_failure_rolls_back_request(tmp_path: Path) -> None:
    class FailingSigner:
        key_id = "failing"

        def sign(self, _message: bytes) -> bytes:
            raise RuntimeError("signer unavailable")

    store = SqliteActivationIssuanceStore(tmp_path / "licenses.sqlite3")
    with pytest.raises(RuntimeError, match="unavailable"):
        issue_from_activation(
            request(),
            expected_product_id="dental-erp",
            issuance=issuance(),
            signer=FailingSigner(),
            store=store,
        )
    assert issue_from_activation(
        request(), expected_product_id="dental-erp", issuance=issuance(), signer=ISSUER, store=store
    )


def test_request_id_conflict_is_rejected_by_memory_and_sqlite(tmp_path: Path) -> None:
    changed = distinct_request(
        request_id="018f47a7-5b9c-7d31-8e1a-c7c77d79f410",
        nonce=b"n" * 24,
        delivery="online",
    )
    stores = [
        InMemoryActivationIssuanceStore(),
        SqliteActivationIssuanceStore(tmp_path / "conflict.sqlite3"),
    ]
    for store in stores:
        issue_from_activation(
            request(),
            expected_product_id="dental-erp",
            issuance=issuance(),
            signer=ISSUER,
            store=store,
        )
        with pytest.raises(ValueError, match="identifier conflict"):
            issue_from_activation(
                changed,
                expected_product_id="dental-erp",
                issuance=issuance(),
                signer=ISSUER,
                store=store,
            )


def test_nonce_replay_is_rejected_by_memory_and_sqlite(tmp_path: Path) -> None:
    changed = distinct_request(
        request_id="018f47a7-5b9c-7d31-8e1a-c7c77d79f499",
        nonce=b"n" * 24,
    )
    stores = [
        InMemoryActivationIssuanceStore(),
        SqliteActivationIssuanceStore(tmp_path / "nonce.sqlite3"),
    ]
    for store in stores:
        issue_from_activation(
            request(),
            expected_product_id="dental-erp",
            issuance=issuance(),
            signer=ISSUER,
            store=store,
        )
        with pytest.raises(ValueError, match="nonce has already been used"):
            issue_from_activation(
                changed,
                expected_product_id="dental-erp",
                issuance=issuance(),
                signer=ISSUER,
                store=store,
            )


def test_emergency_term_cannot_exceed_72_hours() -> None:
    with pytest.raises(ValueError, match="72 hours"):
        issue_from_activation(
            request(),
            expected_product_id="dental-erp",
            issuance=issuance(mode="emergency", expires_at=datetime(2026, 8, 28, tzinfo=UTC)),
            signer=ISSUER,
            store=InMemoryActivationIssuanceStore(),
        )


@pytest.mark.parametrize(
    "change",
    [
        {"customer_id": "invalid customer"},
        {"sequence": True},
        {"entitlements": ()},
        {"entitlements": ("core", "core")},
        {"mode": "unknown"},
    ],
)
def test_invalid_commercial_inputs_are_rejected(change) -> None:
    with pytest.raises(ValueError, match="sequence or entitlements"):
        issue_from_activation(
            request(),
            expected_product_id="dental-erp",
            issuance=issuance(**change),
            signer=ISSUER,
            store=InMemoryActivationIssuanceStore(),
        )
