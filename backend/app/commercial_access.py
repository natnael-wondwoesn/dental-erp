"""Commercial policy shared by hosted and offline products.

This module is not authentication or RBAC. Callers must supply trusted tenant
policy, check membership/permissions, and narrowly authorize recovery operations.
Hosted and offline adapters enforce this policy after authenticated tenant resolution.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from types import MappingProxyType

from app.licensing.decision import LicenseDecision


class ModuleId(StrEnum):
    CORE = "core"
    PATIENTS = "patients"
    APPOINTMENTS = "appointments"
    CLINICAL = "clinical"
    BILLING = "billing"
    INSURANCE = "insurance"
    LAB = "lab"
    BRACES = "braces"
    FINANCE = "finance"
    INVENTORY = "inventory"
    STAFF = "staff"
    REPORTS = "reports"
    CRM = "crm"
    COMMUNICATIONS = "communications"
    FORMS = "forms"
    PORTAL = "portal"
    VIDEO = "video"
    AI = "ai"
    STERILIZATION = "sterilization"
    DEVICES = "devices"
    DATA_IMPORT = "data_import"


MODULE_DEPENDENCIES = MappingProxyType(
    {
        ModuleId.CORE: frozenset(),
        ModuleId.PATIENTS: frozenset({ModuleId.CORE}),
        ModuleId.APPOINTMENTS: frozenset({ModuleId.PATIENTS}),
        ModuleId.CLINICAL: frozenset({ModuleId.PATIENTS}),
        ModuleId.BILLING: frozenset({ModuleId.PATIENTS}),
        ModuleId.INSURANCE: frozenset({ModuleId.BILLING}),
        ModuleId.LAB: frozenset({ModuleId.CLINICAL}),
        ModuleId.BRACES: frozenset({ModuleId.CLINICAL}),
        ModuleId.FINANCE: frozenset({ModuleId.BILLING}),
        ModuleId.INVENTORY: frozenset({ModuleId.CORE}),
        ModuleId.STAFF: frozenset({ModuleId.CORE}),
        ModuleId.REPORTS: frozenset({ModuleId.CORE}),
        ModuleId.CRM: frozenset({ModuleId.PATIENTS}),
        ModuleId.COMMUNICATIONS: frozenset({ModuleId.PATIENTS}),
        ModuleId.FORMS: frozenset({ModuleId.PATIENTS}),
        ModuleId.PORTAL: frozenset({ModuleId.PATIENTS}),
        ModuleId.VIDEO: frozenset({ModuleId.APPOINTMENTS, ModuleId.CLINICAL}),
        ModuleId.AI: frozenset({ModuleId.CORE}),
        ModuleId.STERILIZATION: frozenset({ModuleId.CORE}),
        ModuleId.DEVICES: frozenset({ModuleId.CORE}),
        ModuleId.DATA_IMPORT: frozenset({ModuleId.CORE}),
    }
)


def validate_modules(grants: Iterable[str]) -> frozenset[ModuleId]:
    """Validate explicit grants; never auto-enable a paid dependency."""
    if isinstance(grants, (str, bytes)):
        raise ValueError("Module grants must be a collection of identifiers")
    modules = frozenset(ModuleId(grant) for grant in grants)
    if ModuleId.CORE not in modules:
        raise ValueError("Core module is required")
    for module in sorted(modules):
        missing = MODULE_DEPENDENCIES[module] - modules
        if missing:
            raise ValueError(f"{module} requires explicit grants: {', '.join(sorted(missing))}")
    return modules


class AccessState(StrEnum):
    ACTIVE = "active"
    TRIAL = "trial"
    GRACE = "grace"
    EXPIRED_READ_ONLY = "expired_read_only"
    SUSPENDED_READ_ONLY = "suspended_read_only"
    CANCELED_READ_ONLY = "canceled_read_only"
    RECOVERY = "recovery"


class HostedStatus(StrEnum):
    ACTIVE = "active"
    TRIAL = "trial"
    SUSPENDED = "suspended"
    CANCELED = "canceled"
    MIGRATION = "migration"


class AccessAction(StrEnum):
    READ = "read"
    WRITE = "write"
    RECOVERY = "recovery"


@dataclass(frozen=True, slots=True)
class AccessDecision:
    allowed: bool
    code: str
    state: AccessState


@dataclass(frozen=True, slots=True)
class AccessPolicy:
    state: AccessState
    modules: frozenset[ModuleId]

    def decide(self, *, module: str, action: AccessAction) -> AccessDecision:
        """Recovery is a dedicated audited flow, never a client-selectable bypass.

        Report, AI, and import callers must check every source/destination module
        as well as the entry module. This decision does not grant RBAC permission.
        """
        action = AccessAction(action)
        if action == AccessAction.RECOVERY:
            return AccessDecision(True, "RECOVERY_AVAILABLE", self.state)
        if module not in self.modules:
            return AccessDecision(False, "MODULE_NOT_ENABLED", self.state)
        if action == AccessAction.READ:
            return AccessDecision(True, "ACCESS_ALLOWED", self.state)
        if self.state not in {AccessState.ACTIVE, AccessState.TRIAL, AccessState.GRACE}:
            return AccessDecision(False, "SUBSCRIPTION_WRITE_RESTRICTED", self.state)
        return AccessDecision(True, "ACCESS_ALLOWED", self.state)


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Timezone-aware timestamps are required")
    return value


def hosted_policy(
    *,
    status: HostedStatus,
    modules: Iterable[str],
    access_until: datetime | None,
    grace_until: datetime | None,
    now: datetime,
) -> AccessPolicy:
    """Evaluate current server-owned subscription; deadlines are exclusive.

    Billing computes calendar periods separately. This module never derives a
    month or silently extends grace. Unknown status/grants raise ValueError;
    missing deadlines return recovery rather than granting unlimited access.
    """
    status = HostedStatus(status)
    grants = validate_modules(modules)
    _aware(now)
    if status == HostedStatus.MIGRATION:
        # Explicit vendor-owned grandfathering for existing installations only.
        # New subscriptions still require a deadline; this is not a missing-policy fallback.
        return AccessPolicy(AccessState.ACTIVE, grants)
    if access_until is not None:
        _aware(access_until)
    if grace_until is not None:
        _aware(grace_until)
        if access_until is None or grace_until < access_until:
            raise ValueError("Grace must follow an access deadline")
    if status == HostedStatus.SUSPENDED:
        return AccessPolicy(AccessState.SUSPENDED_READ_ONLY, grants)
    if status == HostedStatus.CANCELED:
        return AccessPolicy(AccessState.CANCELED_READ_ONLY, grants)
    if access_until is None:
        return AccessPolicy(AccessState.RECOVERY, frozenset())
    if now < access_until:
        state = AccessState.TRIAL if status == HostedStatus.TRIAL else AccessState.ACTIVE
    elif status == HostedStatus.ACTIVE and grace_until is not None and now < grace_until:
        state = AccessState.GRACE
    else:
        state = AccessState.EXPIRED_READ_ONLY
    return AccessPolicy(state, grants)


def offline_policy(decision: LicenseDecision, *, expected_customer_id: str) -> AccessPolicy:
    """Consume evaluate_license output, never unverified JSON/runtime summaries.

    Signature/product/installation/time/replay validation belongs to the existing
    license module. Customer binding is checked here too. Only explicit module:
    identifiers grant modules; legacy 'core' is not a wildcard. Strict enforcement
    therefore requires issuing migrated licenses before adapter cutover.
    """
    payload = decision.payload
    if (
        payload is None
        or not expected_customer_id
        or payload.customer_id != expected_customer_id
        or decision.state not in {"active", "grace", "expired_read_only"}
    ):
        return AccessPolicy(AccessState.RECOVERY, frozenset())
    try:
        modules = validate_modules(
            grant.removeprefix("module:")
            for grant in payload.entitlements
            if grant.startswith("module:")
        )
    except ValueError:
        return AccessPolicy(AccessState.RECOVERY, frozenset())
    state = AccessState(decision.state)
    if not decision.allows_read:
        return AccessPolicy(AccessState.RECOVERY, frozenset())
    if not decision.allows_write:
        state = AccessState.EXPIRED_READ_ONLY
    return AccessPolicy(state, modules)
