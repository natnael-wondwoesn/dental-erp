import calendar
import hmac
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import AwareDatetime, Field, StrictBool, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.commercial_access import MODULE_DEPENDENCIES, HostedStatus, hosted_policy, validate_modules
from app.config import get_settings
from app.database import get_session
from app.saas.models import (
    SaaSAuditEvent,
    SaaSDeployment,
    SaaSPayment,
    SaaSTenant,
    SaaSTenantNote,
)
from app.schemas import ApiSchema

router = APIRouter(prefix="/api/saas", tags=["saas"])
Session = Annotated[AsyncSession, Depends(get_session)]
ADDIS = ZoneInfo("Africa/Addis_Ababa")


def authorized(header: str | None, secret: str) -> bool:
    return bool(secret and header and hmac.compare_digest(header, f"Bearer {secret}"))


async def require_admin(
    authorization: Annotated[str | None, Header()] = None,
    x_actor: Annotated[str | None, Header()] = None,
) -> str:
    if not authorized(authorization, get_settings().saas_admin_token) or not x_actor:
        raise HTTPException(401, "Vendor authentication required")
    return x_actor[:128]


async def require_reader(authorization: Annotated[str | None, Header()] = None) -> None:
    if not authorized(authorization, get_settings().saas_reader_token):
        raise HTTPException(401, "Gateway authentication required")


Admin = Annotated[str, Depends(require_admin)]
Reader = Annotated[None, Depends(require_reader)]


class Branding(ApiSchema):
    display_name: str = Field(default="", max_length=180)
    name_am: str = Field(default="", max_length=180)
    logo: str = Field(default="", max_length=500)
    primary_color: str = Field(default="#0769e7", pattern=r"^#[0-9a-fA-F]{6}$")
    contact_email: str = Field(default="", max_length=320)
    contact_phone: str = Field(default="", max_length=40)
    address: str = Field(default="", max_length=500)
    renewal_contact: str = Field(default="Contact your software provider to renew.", max_length=500)

    @field_validator("logo")
    @classmethod
    def safe_logo(cls, value: str) -> str:
        # Assets stay same-origin; no HTML, SVG data URIs, or remote tracking.
        if value and (not value.startswith("/api/uploads/") or ".." in value or "%" in value):
            raise ValueError("Logo must be a tenant-owned upload path")
        return value


class TenantCreate(ApiSchema):
    id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    name: str = Field(min_length=2, max_length=180)
    slug: str = Field(min_length=1, max_length=63, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    hostname: str | None = Field(default=None, max_length=253)
    customer_id: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9._:-]+$")
    mode: Literal["hosted", "offline"] = "hosted"
    plan_name: str = Field(default="Custom", max_length=100)
    modules: list[str] = Field(default_factory=lambda: ["core"])
    branding: Branding = Field(default_factory=Branding)
    access_until: AwareDatetime | None = None
    migration_access: bool = False
    grace_days: int = Field(default=5, ge=0, le=30)
    monthly_fee: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)

    @model_validator(mode="after")
    def has_term(self):
        if self.access_until is None and not self.migration_access:
            raise ValueError("Access deadline is required for a new subscription")
        return self

    @field_validator("modules")
    @classmethod
    def valid_grants(cls, value: list[str]) -> list[str]:
        return sorted(validate_modules(value))

    @field_validator("hostname")
    @classmethod
    def valid_hostname(cls, value: str | None) -> str | None:
        if value is None:
            return None
        import re

        value = value.lower().strip()
        if not re.fullmatch(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}", value):
            raise ValueError("Expected DNS hostname")
        return value


class Revision(ApiSchema):
    revision: int = Field(ge=1)


class ModuleChange(Revision):
    modules: list[str]
    effective_at: AwareDatetime | None = None

    _validate = field_validator("modules")(TenantCreate.valid_grants.__func__)


class BrandChange(Revision):
    branding: Branding


class ClientOptions(ApiSchema):
    recovery_read: StrictBool = False
    backup_export: StrictBool = False
    license_import: StrictBool = False


class ClientOptionsChange(Revision):
    client_options: ClientOptions


class Suspension(Revision):
    suspended: bool
    reason: str = Field(min_length=3, max_length=1000)


class Renewal(ApiSchema):
    reference: str = Field(min_length=3, max_length=120)
    months: int = Field(default=1, ge=1, le=12)
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    currency: Literal["ETB"] = "ETB"


class LicenseRequest(ApiSchema):
    activation_request: str = Field(min_length=10, max_length=65536)


def aware(value: datetime) -> datetime:
    # SQLite tests lose tzinfo; all persisted values have UTC semantics.
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def add_calendar_months(value: datetime, months: int, anchor_day: int) -> datetime:
    local = aware(value).astimezone(ADDIS)
    total = local.year * 12 + local.month - 1 + months
    year, month0 = divmod(total, 12)
    month = month0 + 1
    day = min(anchor_day, calendar.monthrange(year, month)[1])
    return local.replace(year=year, month=month, day=day).astimezone(UTC)


def effective_modules(tenant: SaaSTenant, now: datetime) -> list[str]:
    if tenant.scheduled_at and now >= aware(tenant.scheduled_at):
        return tenant.scheduled_modules or ["core"]
    return tenant.modules


def snapshot(tenant: SaaSTenant, now: datetime | None = None) -> dict:
    now = now or datetime.now(UTC)
    modules = effective_modules(tenant, now)
    policy = hosted_policy(
        status=HostedStatus(tenant.status),
        modules=modules,
        now=now,
        access_until=aware(tenant.access_until) if tenant.access_until else None,
        grace_until=aware(tenant.grace_until) if tenant.grace_until else None,
    )
    return {
        "tenantId": tenant.id,
        "name": tenant.name,
        "slug": tenant.slug,
        "hostname": tenant.hostname,
        "customerId": tenant.customer_id,
        "mode": tenant.mode,
        "planName": tenant.plan_name,
        "branding": tenant.branding,
        "modules": sorted(policy.modules),
        "clientOptions": ClientOptions.model_validate(tenant.client_options or {}).model_dump(by_alias=True),
        "state": policy.state,
        "status": tenant.status,
        "revision": tenant.revision,
        "allowsWrite": policy.state in {"active", "trial", "grace"},
        "accessUntil": aware(tenant.access_until) if tenant.access_until else None,
        "graceUntil": aware(tenant.grace_until) if tenant.grace_until else None,
        "scheduledModules": tenant.scheduled_modules,
        "scheduledAt": aware(tenant.scheduled_at) if tenant.scheduled_at else None,
        "monthlyFee": str(tenant.monthly_fee),
        "currency": tenant.currency,
        "suspensionReason": tenant.suspension_reason,
    }


async def get_tenant(session: AsyncSession, tenant_id: str, revision: int | None = None):
    tenant = await session.scalar(
        select(SaaSTenant).where(SaaSTenant.id == tenant_id).with_for_update()
    )
    if tenant is None:
        raise HTTPException(404, "Tenant not registered")
    if revision is not None and tenant.revision != revision:
        raise HTTPException(409, "Policy changed; refresh before saving")
    if tenant.scheduled_at and datetime.now(UTC) >= aware(tenant.scheduled_at):
        tenant.modules = tenant.scheduled_modules or ["core"]
        tenant.scheduled_at = None
        tenant.scheduled_modules = None
    return tenant


def audit(session: AsyncSession, tenant: SaaSTenant, actor: str, action: str, **details):
    session.add(
        SaaSAuditEvent(
            id=str(uuid.uuid4()),
            tenant_id=tenant.id,
            actor=actor,
            action=action,
            details={"revision": tenant.revision, **details},
        )
    )


@router.get("/catalog")
async def catalog(_reader: Reader):
    return {
        "version": 1,
        "modules": [
            {"id": key, "requires": sorted(value)} for key, value in MODULE_DEPENDENCIES.items()
        ],
    }


@router.get("/access/{tenant_id}")
async def access(tenant_id: str, _reader: Reader, session: Session):
    tenant = await session.get(SaaSTenant, tenant_id)
    if tenant is None:
        raise HTTPException(404, "Tenant not registered")
    return snapshot(tenant)


@router.get("/eligible")
async def eligible(_reader: Reader, session: Session, modules: str):
    required = set(modules.split(","))
    if not required or not required.issubset(MODULE_DEPENDENCIES):
        raise HTTPException(422, "Unknown module")
    rows = (await session.scalars(select(SaaSTenant))).all()
    policies = [snapshot(row) for row in rows]
    return {
        "tenantIds": [
            row["tenantId"]
            for row in policies
            if row["allowsWrite"] and required.issubset(row["modules"])
        ]
    }


@router.get("/branding")
async def public_branding(hostname: str, _reader: Reader, session: Session):
    tenant = await session.scalar(select(SaaSTenant).where(SaaSTenant.hostname == hostname.lower()))
    if tenant is None:
        raise HTTPException(404, "Clinic domain not registered")
    return {
        "tenantId": tenant.id,
        "name": tenant.name,
        "slug": tenant.slug,
        "branding": tenant.branding,
    }


@router.get("/admin/tenants")
async def list_tenants(_actor: Admin, session: Session):
    rows = (await session.scalars(select(SaaSTenant).order_by(SaaSTenant.name))).all()
    return {"tenants": [snapshot(row) for row in rows]}


@router.post("/admin/tenants", status_code=201)
async def create_tenant(payload: TenantCreate, actor: Admin, session: Session):
    if await session.scalar(
        select(SaaSTenant).where(
            (SaaSTenant.id == payload.id)
            | (SaaSTenant.slug == payload.slug)
            | ((SaaSTenant.hostname == payload.hostname) if payload.hostname else False)
        )
    ):
        raise HTTPException(409, "Clinic ID, slug, or hostname already registered")
    tenant = SaaSTenant(
        **payload.model_dump(exclude={"branding", "grace_days", "migration_access"}),
        branding=payload.branding.model_dump(by_alias=True),
        grace_until=payload.access_until + timedelta(days=payload.grace_days)
        if payload.access_until
        else None,
        anchor_day=payload.access_until.astimezone(ADDIS).day if payload.access_until else 1,
        revision=1,
        status="migration" if payload.migration_access else "active",
        currency="ETB",
    )
    session.add(tenant)
    await session.flush()
    audit(session, tenant, actor, "REGISTER", modules=tenant.modules)
    return snapshot(tenant)


@router.put("/admin/tenants/{tenant_id}/modules")
async def change_modules(tenant_id: str, payload: ModuleChange, actor: Admin, session: Session):
    tenant = await get_tenant(session, tenant_id, payload.revision)
    before = effective_modules(tenant, datetime.now(UTC))
    if payload.effective_at and payload.effective_at > datetime.now(UTC):
        tenant.scheduled_modules = payload.modules
        tenant.scheduled_at = payload.effective_at
    else:
        tenant.modules = payload.modules
        tenant.scheduled_modules = None
        tenant.scheduled_at = None
    tenant.revision += 1
    audit(
        session,
        tenant,
        actor,
        "MODULES",
        before=before,
        after=payload.modules,
        effectiveAt=payload.effective_at.isoformat() if payload.effective_at else None,
    )
    await session.flush()
    return snapshot(tenant)


@router.put("/admin/tenants/{tenant_id}/client-options")
async def change_client_options(tenant_id: str, payload: ClientOptionsChange, actor: Admin, session: Session):
    tenant = await get_tenant(session, tenant_id, payload.revision)
    before = tenant.client_options or {}
    tenant.client_options = payload.client_options.model_dump(by_alias=True)
    tenant.revision += 1
    audit(session, tenant, actor, "CLIENT_OPTIONS", before=before, after=tenant.client_options)
    return snapshot(tenant)


@router.put("/admin/tenants/{tenant_id}/branding")
async def change_branding(tenant_id: str, payload: BrandChange, actor: Admin, session: Session):
    tenant = await get_tenant(session, tenant_id, payload.revision)
    if payload.branding.logo and not payload.branding.logo.startswith(f"/api/uploads/{tenant_id}/"):
        raise HTTPException(422, "Logo must belong to this clinic")
    tenant.branding = payload.branding.model_dump(by_alias=True)
    tenant.revision += 1
    audit(session, tenant, actor, "BRANDING", branding=tenant.branding)
    return snapshot(tenant)


@router.put("/admin/tenants/{tenant_id}/suspension")
async def suspend(tenant_id: str, payload: Suspension, actor: Admin, session: Session):
    tenant = await get_tenant(session, tenant_id, payload.revision)
    if payload.suspended:
        if tenant.status != "suspended":
            tenant.resume_status = tenant.status
        tenant.status = "suspended"
    else:
        tenant.status = tenant.resume_status
    tenant.suspension_reason = payload.reason if payload.suspended else None
    tenant.revision += 1
    audit(
        session, tenant, actor, "SUSPEND" if payload.suspended else "RESTORE", reason=payload.reason
    )
    return snapshot(tenant)


@router.post("/admin/tenants/{tenant_id}/renew")
async def renew(tenant_id: str, payload: Renewal, actor: Admin, session: Session):
    tenant = await get_tenant(session, tenant_id)
    existing = await session.scalar(
        select(SaaSPayment).where(
            SaaSPayment.tenant_id == tenant_id,
            SaaSPayment.reference == payload.reference,
        )
    )
    if existing:
        if (existing.amount, existing.months, existing.currency) != (
            payload.amount,
            payload.months,
            payload.currency,
        ):
            raise HTTPException(409, "Payment reference already used with different details")
        return {"tenant": snapshot(tenant), "paymentId": existing.id, "duplicate": True}
    now = datetime.now(UTC)
    start = max(aware(tenant.access_until), now) if tenant.access_until else now
    if not tenant.access_until or aware(tenant.access_until) < now:
        tenant.anchor_day = start.astimezone(ADDIS).day
    end = add_calendar_months(start, payload.months, tenant.anchor_day)
    tenant.access_until = end
    tenant.grace_until = end + timedelta(days=5)
    if tenant.status != "suspended":
        tenant.status = "active"
    tenant.resume_status = "active"
    tenant.revision += 1
    payment_id = str(uuid.uuid4())
    session.add(
        SaaSPayment(
            id=payment_id,
            tenant_id=tenant_id,
            reference=payload.reference,
            amount=payload.amount,
            months=payload.months,
            currency=payload.currency,
            period_start=start,
            period_end=end,
            verified_by=actor,
        )
    )
    audit(
        session,
        tenant,
        actor,
        "RENEW",
        reference=payload.reference,
        amount=str(payload.amount),
        months=payload.months,
        periodEnd=end.isoformat(),
    )
    await session.flush()
    return {"tenant": snapshot(tenant), "paymentId": payment_id, "duplicate": False}


@router.get("/admin/tenants/{tenant_id}/history")
async def history(tenant_id: str, _actor: Admin, session: Session):
    await get_tenant(session, tenant_id)
    rows = (
        await session.scalars(
            select(SaaSAuditEvent)
            .where(SaaSAuditEvent.tenant_id == tenant_id)
            .order_by(SaaSAuditEvent.created_at.desc())
            .limit(100)
        )
    ).all()
    return {
        "events": [
            {
                "id": row.id,
                "actor": row.actor,
                "action": row.action,
                "details": row.details,
                "createdAt": row.created_at,
            }
            for row in rows
        ]
    }


@router.post("/admin/tenants/{tenant_id}/license")
async def issue_offline_license(
    tenant_id: str, payload: LicenseRequest, actor: Admin, session: Session
):
    from app.saas.issuance import issue_license

    return await issue_license(session, tenant_id, payload.activation_request, actor)


# ---------------------------------------------------------------- fleet management


class BulkModules(ApiSchema):
    tenant_ids: list[str] = Field(min_length=1, max_length=200)
    add: list[str] = Field(default_factory=list)
    remove: list[str] = Field(default_factory=list)


class Profile(Revision):
    name: str = Field(min_length=2, max_length=180)
    plan_name: str = Field(min_length=1, max_length=100)
    monthly_fee: Decimal = Field(ge=0, max_digits=14, decimal_places=2)


class NoteCreate(ApiSchema):
    body: str = Field(min_length=1, max_length=4000)


class DeploymentRecord(ApiSchema):
    client: str = Field(pattern=r"^[a-z0-9][a-z0-9-]*$", max_length=63)
    version: str = Field(min_length=1, max_length=64, pattern=r"^[0-9A-Za-z._-]+$")
    previous_version: str | None = Field(default=None, max_length=128)
    status: Literal["SUCCEEDED", "FAILED", "ROLLED_BACK"]
    detail: str | None = Field(default=None, max_length=2000)
    run_url: str | None = Field(default=None, max_length=500, pattern=r"^https://")


@router.get("/admin/overview")
async def overview(_actor: Admin, session: Session):
    now = datetime.now(UTC)
    rows = (await session.scalars(select(SaaSTenant))).all()
    snapshots = [snapshot(row, now) for row in rows]
    by_state: dict[str, int] = {}
    adoption: dict[str, int] = {}
    expiring = []
    for item in snapshots:
        by_state[item["state"]] = by_state.get(item["state"], 0) + 1
        for module in item["modules"]:
            adoption[module] = adoption.get(module, 0) + 1
        until = item["accessUntil"]
        if until and now <= until <= now + timedelta(days=14):
            expiring.append({"tenantId": item["tenantId"], "name": item["name"], "accessUntil": until})
    monthly = sum((Decimal(item["monthlyFee"]) for item in snapshots), Decimal("0"))
    latest = {}
    for deployment in (
        await session.scalars(select(SaaSDeployment).order_by(SaaSDeployment.created_at.desc()))
    ).all():
        latest.setdefault(deployment.client, deployment)
    return {
        "tenants": len(snapshots),
        "byState": by_state,
        "moduleAdoption": adoption,
        "expiringSoon": sorted(expiring, key=lambda row: row["accessUntil"]),
        "monthlyRecurring": str(monthly),
        "currency": "ETB",
        "versions": [
            {
                "client": row.client,
                "version": row.version,
                "status": row.status,
                "at": row.created_at,
            }
            for row in latest.values()
        ],
    }


@router.get("/admin/audit")
async def fleet_audit(
    _actor: Admin,
    session: Session,
    limit: int = 100,
    action: str | None = None,
    tenant_id: str | None = None,
):
    query = select(SaaSAuditEvent, SaaSTenant.name).join(
        SaaSTenant, SaaSTenant.id == SaaSAuditEvent.tenant_id
    )
    if action:
        query = query.where(SaaSAuditEvent.action == action.upper()[:60])
    if tenant_id:
        query = query.where(SaaSAuditEvent.tenant_id == tenant_id[:64])
    rows = (
        await session.execute(
            query.order_by(SaaSAuditEvent.created_at.desc()).limit(max(1, min(limit, 500)))
        )
    ).all()
    return {
        "events": [
            {
                "id": event.id,
                "tenantId": event.tenant_id,
                "tenantName": name,
                "actor": event.actor,
                "action": event.action,
                "details": event.details,
                "createdAt": event.created_at,
            }
            for event, name in rows
        ]
    }


@router.post("/admin/modules/bulk")
async def bulk_modules(payload: BulkModules, actor: Admin, session: Session):
    if not payload.add and not payload.remove:
        raise HTTPException(422, "Choose at least one module to add or remove")
    results = []
    for tenant_id in dict.fromkeys(payload.tenant_ids):
        tenant = await get_tenant(session, tenant_id)
        before = list(effective_modules(tenant, datetime.now(UTC)))
        target = (set(before) | set(payload.add)) - set(payload.remove)
        try:
            validated = sorted(validate_modules(target))
        except ValueError as exc:
            # One clinic's dependency problem must not half-apply the batch.
            raise HTTPException(422, f"{tenant.name}: {exc}") from exc
        if validated == sorted(before):
            results.append({"tenantId": tenant.id, "changed": False})
            continue
        tenant.modules = validated
        tenant.scheduled_modules = None
        tenant.scheduled_at = None
        tenant.revision += 1
        audit(session, tenant, actor, "MODULES", before=before, after=validated, bulk=True)
        results.append({"tenantId": tenant.id, "changed": True})
    await session.flush()
    return {"results": results}


@router.put("/admin/tenants/{tenant_id}/profile")
async def change_profile(tenant_id: str, payload: Profile, actor: Admin, session: Session):
    tenant = await get_tenant(session, tenant_id, payload.revision)
    before = {"name": tenant.name, "planName": tenant.plan_name, "monthlyFee": str(tenant.monthly_fee)}
    tenant.name = payload.name.strip()
    tenant.plan_name = payload.plan_name.strip()
    tenant.monthly_fee = payload.monthly_fee
    tenant.revision += 1
    audit(
        session,
        tenant,
        actor,
        "PROFILE",
        before=before,
        after={
            "name": tenant.name,
            "planName": tenant.plan_name,
            "monthlyFee": str(tenant.monthly_fee),
        },
    )
    return snapshot(tenant)


@router.get("/admin/tenants/{tenant_id}/notes")
async def list_notes(tenant_id: str, _actor: Admin, session: Session):
    await get_tenant(session, tenant_id)
    rows = (
        await session.scalars(
            select(SaaSTenantNote)
            .where(SaaSTenantNote.tenant_id == tenant_id)
            .order_by(SaaSTenantNote.created_at.desc())
            .limit(200)
        )
    ).all()
    return {
        "notes": [
            {"id": r.id, "author": r.author, "body": r.body, "createdAt": r.created_at}
            for r in rows
        ]
    }


@router.post("/admin/tenants/{tenant_id}/notes", status_code=201)
async def add_note(tenant_id: str, payload: NoteCreate, actor: Admin, session: Session):
    await get_tenant(session, tenant_id)
    note = SaaSTenantNote(
        id=str(uuid.uuid4()), tenant_id=tenant_id, author=actor, body=payload.body.strip()
    )
    session.add(note)
    await session.flush()
    return {"id": note.id, "author": note.author, "body": note.body}


@router.post("/admin/deployments", status_code=201)
async def record_deployment(payload: DeploymentRecord, _actor: Admin, session: Session):
    row = SaaSDeployment(id=str(uuid.uuid4()), **payload.model_dump())
    session.add(row)
    await session.flush()
    return {"id": row.id}


@router.get("/admin/deployments")
async def list_deployments(_actor: Admin, session: Session, limit: int = 100):
    rows = (
        await session.scalars(
            select(SaaSDeployment)
            .order_by(SaaSDeployment.created_at.desc())
            .limit(max(1, min(limit, 500)))
        )
    ).all()
    total = await session.scalar(select(func.count()).select_from(SaaSDeployment))
    return {
        "total": total,
        "deployments": [
            {
                "id": r.id,
                "client": r.client,
                "version": r.version,
                "previousVersion": r.previous_version,
                "status": r.status,
                "detail": r.detail,
                "runUrl": r.run_url,
                "createdAt": r.created_at,
            }
            for r in rows
        ],
    }
