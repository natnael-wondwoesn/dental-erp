import base64
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.commercial_access import (
    MODULE_DEPENDENCIES,
    AccessAction,
    AccessState,
    HostedStatus,
    ModuleId,
    hosted_policy,
    offline_policy,
    validate_modules,
)
from app.licensing.decision import LicenseEvidence, evaluate_license

DEADLINE = datetime(2026, 11, 1, tzinfo=UTC)
GRACE_END = DEADLINE + timedelta(days=5)
STARTER = {"core", "patients", "appointments", "clinical"}
VECTOR = json.loads(
    (Path(__file__).parents[2] / "docs/licensing/test-vectors/v1-valid.json").read_text()
)


def hosted(**overrides):
    return hosted_policy(
        **{
            "status": HostedStatus.ACTIVE,
            "modules": STARTER,
            "access_until": DEADLINE,
            "grace_until": GRACE_END,
            "now": DEADLINE - timedelta(seconds=1),
            **overrides,
        }
    )


def test_explicit_dependencies_do_not_silently_enable_paid_modules():
    with pytest.raises(ValueError, match="billing requires explicit grants: patients"):
        validate_modules({"core", "billing"})
    with pytest.raises(ValueError, match="video requires explicit grants: clinical"):
        validate_modules({"core", "patients", "appointments", "video"})


@pytest.mark.parametrize("grants", [[], ["patients"], ["core", "unknown"], "core", ["*"]])
def test_invalid_or_wildcard_grants_are_rejected(grants):
    with pytest.raises(ValueError):
        validate_modules(grants)


def test_complete_catalog_has_no_cycles_and_every_module_is_grantable():
    assert validate_modules(ModuleId) == frozenset(ModuleId)

    def visit(module, ancestors):
        assert module not in ancestors, f"Dependency cycle at {module}"
        for dependency in MODULE_DEPENDENCIES[module]:
            visit(dependency, ancestors | {module})

    for module in ModuleId:
        visit(module, set())


def test_different_clinics_can_get_different_grants_without_role_changes():
    starter = hosted()
    practice = hosted(modules=STARTER | {"billing"})
    assert starter.decide(module="billing", action=AccessAction.WRITE).code == "MODULE_NOT_ENABLED"
    assert practice.decide(module="billing", action=AccessAction.WRITE).allowed
    assert starter.decide(module="patients", action=AccessAction.WRITE).allowed
    assert not starter.decide(module="unknown", action=AccessAction.READ).allowed


@pytest.mark.parametrize(
    ("now", "expected", "writes"),
    [
        (DEADLINE - timedelta(microseconds=1), AccessState.ACTIVE, True),
        (DEADLINE, AccessState.GRACE, True),
        (GRACE_END - timedelta(microseconds=1), AccessState.GRACE, True),
        (GRACE_END, AccessState.EXPIRED_READ_ONLY, False),
        (GRACE_END + timedelta(days=1), AccessState.EXPIRED_READ_ONLY, False),
    ],
)
def test_hosted_deadline_boundaries_preserve_reads_and_recovery(now, expected, writes):
    policy = hosted(now=now)
    assert policy.state == expected
    assert policy.decide(module="clinical", action=AccessAction.WRITE).allowed is writes
    assert policy.decide(module="clinical", action=AccessAction.READ).allowed
    assert policy.decide(module="core", action=AccessAction.RECOVERY).allowed


def test_trial_does_not_inherit_payment_grace():
    assert hosted(status=HostedStatus.TRIAL).state == AccessState.TRIAL
    assert hosted(status=HostedStatus.TRIAL, now=DEADLINE).state == AccessState.EXPIRED_READ_ONLY


def test_no_grace_means_expire_at_deadline():
    assert hosted(now=DEADLINE, grace_until=None).state == AccessState.EXPIRED_READ_ONLY


@pytest.mark.parametrize("status", [HostedStatus.SUSPENDED, HostedStatus.CANCELED])
def test_vendor_lock_overrides_future_paid_deadline(status):
    policy = hosted(status=status)
    decision = policy.decide(module="patients", action=AccessAction.WRITE)
    assert not decision.allowed
    assert decision.code == "SUBSCRIPTION_WRITE_RESTRICTED"
    assert policy.decide(module="patients", action=AccessAction.READ).allowed
    assert policy.decide(module="core", action=AccessAction.RECOVERY).allowed


def test_updated_status_or_renewed_deadline_restores_writes():
    assert (
        not hosted(status=HostedStatus.SUSPENDED)
        .decide(module="patients", action=AccessAction.WRITE)
        .allowed
    )
    assert (
        hosted(status=HostedStatus.ACTIVE)
        .decide(module="patients", action=AccessAction.WRITE)
        .allowed
    )
    assert (
        hosted(now=GRACE_END, access_until=GRACE_END + timedelta(days=20), grace_until=None)
        .decide(module="patients", action=AccessAction.WRITE)
        .allowed
    )


def test_missing_deadline_does_not_grant_unlimited_subscription():
    policy = hosted(access_until=None, grace_until=None)
    assert policy.state == AccessState.RECOVERY
    assert not policy.decide(module="patients", action=AccessAction.WRITE).allowed
    assert policy.decide(module="core", action=AccessAction.RECOVERY).allowed


@pytest.mark.parametrize("field", ["now", "access_until", "grace_until"])
def test_naive_timestamps_are_rejected(field):
    with pytest.raises(ValueError, match="Timezone-aware"):
        hosted(**{field: datetime(2026, 11, 1)})


def test_equivalent_timezones_produce_same_decision():
    local_deadline = datetime.fromisoformat("2026-11-01T03:00:00+03:00")
    assert hosted(now=local_deadline) == hosted(now=DEADLINE)


def test_unknown_status_action_and_reversed_grace_fail_closed():
    with pytest.raises(ValueError):
        hosted(status="paid_by_client")
    with pytest.raises(ValueError, match="Grace"):
        hosted(grace_until=DEADLINE - timedelta(seconds=1))
    with pytest.raises(ValueError):
        hosted().decide(module="patients", action="POST")


def signed_document(entitlements):
    """Sign with the repository's public test-vector key, never a production key."""
    envelope = VECTOR["license"]
    payload = json.loads(base64.urlsafe_b64decode(envelope["payload"] + "=="))
    payload["entitlements"] = entitlements
    encoded = (
        base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode())
        .rstrip(b"=")
        .decode()
    )
    key = Ed25519PrivateKey.from_private_bytes(bytes.fromhex(VECTOR["private_seed_hex"]))
    signature = key.sign(f"{envelope['protected']}.{encoded}".encode("ascii"))
    return {
        **envelope,
        "payload": encoded,
        "signature": base64.urlsafe_b64encode(signature).rstrip(b"=").decode(),
    }


def offline(*, entitlements=None, at=None, customer="customer-sunny-smile", **overrides):
    decision = evaluate_license(
        **{
            "license": signed_document(
                entitlements
                if entitlements is not None
                else [f"module:{module}" for module in STARTER]
            ),
            "product_id": "dental-erp",
            "installation_id": "installation-test-01",
            "public_keys": {"test-2026-01": VECTOR["public_key_pem"]},
            "now": at or datetime(2026, 8, 20, tzinfo=UTC),
            **overrides,
        }
    )
    return offline_policy(decision, expected_customer_id=customer)


def test_verified_offline_grants_match_hosted_module_behavior():
    policy = offline()
    assert policy.state == AccessState.ACTIVE
    assert policy.modules == hosted().modules
    assert policy.decide(module="clinical", action=AccessAction.WRITE).allowed
    assert not policy.decide(module="finance", action=AccessAction.READ).allowed


@pytest.mark.parametrize(
    "grants",
    [
        ["core"],
        ["module:core", "module:billing"],
        ["module:core", "module:future_module"],
        ["module:core", "module:patients", "module:video"],
    ],
)
def test_legacy_unknown_and_incomplete_offline_grants_never_unlock_modules(grants):
    policy = offline(entitlements=grants)
    assert policy.state == AccessState.RECOVERY
    assert not policy.decide(module="patients", action=AccessAction.WRITE).allowed
    assert policy.decide(module="core", action=AccessAction.RECOVERY).allowed


def test_other_signed_capabilities_are_not_interpreted_as_modules():
    policy = offline(entitlements=["module:core", "feature:handwrittenDiagnosis"])
    assert policy.modules == {ModuleId.CORE}


@pytest.mark.parametrize(
    "overrides",
    [
        {"customer": "different-customer"},
        {"customer": ""},
        {"installation_id": "different-installation"},
        {"product_id": "different-product"},
        {"public_keys": {}},
        {"evidence": LicenseEvidence(highest_sequence=2)},
        {"evidence": LicenseEvidence(max_observed_at="2026-08-22T00:00:00Z")},
        {"at": datetime(2026, 7, 1, tzinfo=UTC)},
    ],
)
def test_offline_identity_trust_time_and_replay_failures_allow_only_recovery(overrides):
    policy = offline(**overrides)
    assert policy.state == AccessState.RECOVERY
    assert not policy.decide(module="patients", action=AccessAction.WRITE).allowed
    assert policy.decide(module="core", action=AccessAction.RECOVERY).allowed


def test_tampered_offline_signature_cannot_grant_modules():
    document = signed_document(["module:core", "module:patients"])
    document["signature"] = "A" * 86
    assert offline(license=document).state == AccessState.RECOVERY


def test_offline_expiry_reuses_existing_five_day_grace_contract():
    grace = offline(at=datetime(2026, 9, 5, 23, 59, 59, tzinfo=UTC))
    expired = offline(at=datetime(2026, 9, 6, tzinfo=UTC))
    assert grace.state == AccessState.GRACE
    assert grace.decide(module="patients", action=AccessAction.WRITE).allowed
    assert expired.state == AccessState.EXPIRED_READ_ONLY
    assert not expired.decide(module="patients", action=AccessAction.WRITE).allowed
    assert expired.decide(module="patients", action=AccessAction.READ).allowed


def test_typescript_catalog_matches_canonical_policy():
    catalog = json.loads((Path(__file__).parents[2] / "config/saas-modules.json").read_text())
    assert catalog == {str(key): sorted(value) for key, value in MODULE_DEPENDENCIES.items()}
