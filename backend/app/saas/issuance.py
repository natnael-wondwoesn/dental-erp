import hashlib
import json
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.licensing.activation import verify_activation_request
from app.licensing.issuer import Ed25519LicenseSigner, LicenseIssuance, create_license_document
from app.saas.models import SaaSLicenseIssuance
from app.saas.router import audit, aware, effective_modules, get_tenant


async def issue_license(session: AsyncSession, tenant_id: str, raw_request: str, actor: str):
    tenant = await get_tenant(session, tenant_id)
    if tenant.mode != "offline":
        raise HTTPException(422, "Only offline installations use signed licenses")
    try:
        activation = verify_activation_request(raw_request)
    except (ValueError, TypeError, KeyError) as exc:
        raise HTTPException(422, "Invalid activation request") from exc
    if activation.product_id != "dental-erp":
        raise HTTPException(422, "Activation request belongs to another product")
    fingerprint = hashlib.sha256(
        json.dumps(json.loads(raw_request), sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    previous = await session.scalar(
        select(SaaSLicenseIssuance).where(
            (SaaSLicenseIssuance.request_id == activation.request_id)
            | (SaaSLicenseIssuance.nonce == activation.nonce)
        )
    )
    if previous:
        if previous.tenant_id != tenant_id or previous.fingerprint != fingerprint:
            raise HTTPException(409, "Activation request or nonce already bound")
        return json.loads(previous.document)
    binding = await session.scalar(
        select(SaaSLicenseIssuance).where(
            (SaaSLicenseIssuance.tenant_id == tenant_id)
            | (SaaSLicenseIssuance.installation_id == activation.installation_id)
        )
    )
    if binding and (
        binding.installation_id != activation.installation_id or binding.tenant_id != tenant_id
    ):
        raise HTTPException(409, "Installation already bound; an audited rehost is required")
    now = datetime.now(UTC)
    if (
        tenant.status != "active"
        or tenant.access_until is None
        or aware(tenant.access_until) <= now
    ):
        raise HTTPException(423, "Renew and restore the subscription before issuing a license")
    settings = get_settings()
    if settings.saas_issuer_seed_path is None:
        raise HTTPException(503, "Vendor signing key not configured")
    signer = Ed25519LicenseSigner(
        settings.saas_issuer_key_id, settings.saas_issuer_seed_path.read_bytes()
    )
    highest = await session.scalar(
        select(func.max(SaaSLicenseIssuance.sequence)).where(
            SaaSLicenseIssuance.installation_id == activation.installation_id
        )
    )
    sequence = (highest or 0) + 1
    expires = aware(tenant.access_until)
    if tenant.scheduled_at and now < aware(tenant.scheduled_at) < expires:
        expires = aware(tenant.scheduled_at)
    document = create_license_document(
        activation,
        LicenseIssuance(
            customer_id=tenant.customer_id,
            sequence=sequence,
            issued_at=now,
            not_before=now,
            expires_at=expires,
            entitlements=tuple(f"module:{module}" for module in effective_modules(tenant, now)),
        ),
        signer,
    )
    session.add(
        SaaSLicenseIssuance(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            installation_id=activation.installation_id,
            sequence=sequence,
            request_id=activation.request_id,
            nonce=activation.nonce,
            fingerprint=fingerprint,
            document=document,
        )
    )
    audit(
        session,
        tenant,
        actor,
        "ISSUE_LICENSE",
        installationId=activation.installation_id,
        sequence=sequence,
        expiresAt=expires.isoformat(),
    )
    await session.flush()
    return json.loads(document)
