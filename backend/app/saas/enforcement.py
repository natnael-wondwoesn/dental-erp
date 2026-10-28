from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.commercial_access import (
    AccessAction,
    AccessPolicy,
    AccessState,
    hosted_policy,
    offline_policy,
)
from app.config import get_settings
from app.licensing.decision import evaluate_license
from app.licensing.runtime import LicenseRuntime
from app.saas.models import SaaSTenant
from app.saas.router import aware, effective_modules

PERMISSION_MODULE = {
    "patients": "patients",
    "appointments": "appointments",
    "clinical": "clinical",
    "treatment_plans": "clinical",
    "billing": "billing",
    "payments": "billing",
    "insurance": "insurance",
    "lab": "lab",
    "finance": "finance",
    "reports": "reports",
    "staff": "staff",
    "dashboard": "core",
    "rbac": "core",
    "license": "core",
}


async def enforce_commercial_access(
    session: AsyncSession,
    tenant_id: str,
    permission: str,
    method: str,
    runtime: LicenseRuntime,
):
    settings = get_settings()
    if settings.saas_enforcement == "disabled":
        return
    if permission == "license.manage":
        return  # Authenticated, permission-checked recovery only.
    now = datetime.now(UTC)
    policy = AccessPolicy(AccessState.RECOVERY, frozenset())
    if settings.saas_enforcement == "hosted":
        tenant = await session.get(SaaSTenant, tenant_id)
        if tenant:
            policy = hosted_policy(
                status=tenant.status,
                modules=effective_modules(tenant, now),
                now=now,
                access_until=aware(tenant.access_until) if tenant.access_until else None,
                grace_until=aware(tenant.grace_until) if tenant.grace_until else None,
            )
    elif settings.license_enforcement == "required":
        await runtime.decide(now=now)
        try:
            decision = evaluate_license(
                license=runtime.store.read_license(),
                product_id=settings.license_product_id,
                installation_id=runtime.store.read_installation_id(),
                public_keys=runtime.public_keys,
                evidence=runtime.store.read_evidence(),
                now=now,
            )
            policy = offline_policy(decision, expected_customer_id=settings.saas_customer_id)
        except (ValueError, OSError):
            pass
    module = PERMISSION_MODULE.get(permission.split(".")[0], "unregistered")
    required = [module]
    # Legacy aggregate implementations span these domains. Fail closed until each
    # payload is composed from independently entitled sources.
    if permission == "dashboard.read":
        required = ["patients", "appointments", "billing", "finance", "lab"]
    elif permission == "reports.read":
        required += ["patients", "appointments", "clinical", "billing", "finance", "staff"]
    for key in required:
        decision = policy.decide(
            module=key,
            action=AccessAction.READ
            if method in {"GET", "HEAD", "OPTIONS"}
            else AccessAction.WRITE,
        )
        if not decision.allowed:
            raise HTTPException(
                423 if decision.code == "SUBSCRIPTION_WRITE_RESTRICTED" else 403,
                {"code": decision.code, "state": decision.state},
            )
