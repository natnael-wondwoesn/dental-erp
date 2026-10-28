import json
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.config import get_settings
from app.saas.models import SaaSAuditEvent, SaaSPayment, SaaSTenant
from app.saas.router import add_calendar_months

ADMIN = {"Authorization": "Bearer unit-vendor-token", "X-Actor": "vendor-user"}
READER = {"Authorization": "Bearer unit-reader-token"}


@pytest.fixture(autouse=True)
def configure_tokens(monkeypatch):
    monkeypatch.setattr(get_settings(), "saas_admin_token", "unit-vendor-token")
    monkeypatch.setattr(get_settings(), "saas_reader_token", "unit-reader-token")


def clinic(tenant_id="clinic-a", **overrides):
    return {
        "id": tenant_id,
        "name": f"{tenant_id} Dental",
        "slug": tenant_id,
        "customerId": f"customer-{tenant_id}",
        "modules": ["core", "patients"],
        "accessUntil": (datetime.now(UTC) + timedelta(days=20)).isoformat(),
        **overrides,
    }


async def register(client, tenant_id="clinic-a", **overrides):
    response = await client.post(
        "/api/saas/admin/tenants", headers=ADMIN, json=clinic(tenant_id, **overrides)
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_vendor_auth_and_reader_separation(client):
    assert (await client.get("/api/saas/admin/tenants")).status_code == 401
    assert (await client.get("/api/saas/admin/tenants", headers=READER)).status_code == 401
    assert (await client.get("/api/saas/access/clinic-a", headers=ADMIN)).status_code == 401
    await register(client)
    assert (await client.get("/api/saas/access/clinic-a", headers=READER)).json()[
        "tenantId"
    ] == "clinic-a"
    assert (await client.get("/api/saas/access/unknown", headers=READER)).status_code == 404


async def test_clinics_have_independent_modules_and_optimistic_revision(client):
    first = await register(client)
    await register(client, "clinic-b", modules=["core", "patients", "billing"])
    changed = await client.put(
        "/api/saas/admin/tenants/clinic-a/modules",
        headers=ADMIN,
        json={"revision": first["revision"], "modules": ["core"]},
    )
    assert changed.status_code == 200
    assert changed.json()["modules"] == ["core"]
    stale = await client.put(
        "/api/saas/admin/tenants/clinic-a/modules",
        headers=ADMIN,
        json={"revision": 1, "modules": ["core", "patients"]},
    )
    assert stale.status_code == 409
    other = (await client.get("/api/saas/access/clinic-b", headers=READER)).json()
    assert "billing" in other["modules"]


async def test_dependency_and_brand_validation(client):
    invalid = await client.post(
        "/api/saas/admin/tenants", headers=ADMIN, json=clinic(modules=["core", "billing"])
    )
    assert invalid.status_code == 422
    await register(client)
    invalid_change = await client.put(
        "/api/saas/admin/tenants/clinic-a/modules",
        headers=ADMIN,
        json={"revision": 1, "modules": ["core", "video"]},
    )
    assert invalid_change.status_code == 422
    for logo in ["javascript:alert(1)", "/api/uploads/clinic-b/logo.png"]:
        response = await client.put(
            "/api/saas/admin/tenants/clinic-a/branding",
            headers=ADMIN,
            json={"revision": 1, "branding": {"logo": logo}},
        )
        assert response.status_code == 422
    response = await client.put(
        "/api/saas/admin/tenants/clinic-a/branding",
        headers=ADMIN,
        json={"revision": 1, "branding": {"displayName": "ለምለም Dental", "primaryColor": "#123456"}},
    )
    assert response.status_code == 200
    assert response.json()["branding"]["displayName"] == "ለምለም Dental"


async def test_suspension_blocks_eligible_jobs_and_restore_is_audited(client, session_factory):
    await register(client)
    before = await client.get("/api/saas/eligible?modules=patients", headers=READER)
    assert before.json()["tenantIds"] == ["clinic-a"]
    response = await client.put(
        "/api/saas/admin/tenants/clinic-a/suspension",
        headers=ADMIN,
        json={"revision": 1, "suspended": True, "reason": "Payment overdue"},
    )
    assert response.json()["allowsWrite"] is False
    assert (await client.get("/api/saas/eligible?modules=patients", headers=READER)).json()[
        "tenantIds"
    ] == []
    restored = await client.put(
        "/api/saas/admin/tenants/clinic-a/suspension",
        headers=ADMIN,
        json={"revision": 2, "suspended": False, "reason": "Payment verified"},
    )
    assert restored.json()["allowsWrite"] is True
    async with session_factory() as session:
        events = (await session.scalars(select(SaaSAuditEvent))).all()
        assert [row.action for row in events] == ["REGISTER", "SUSPEND", "RESTORE"]
        assert all(row.actor == "vendor-user" for row in events)


async def test_renewal_is_idempotent_and_does_not_remove_manual_suspension(client, session_factory):
    registered = await register(client)
    body = {"reference": "bank-100", "amount": "1250.00", "months": 1, "currency": "ETB"}
    first = await client.post("/api/saas/admin/tenants/clinic-a/renew", headers=ADMIN, json=body)
    assert first.status_code == 200, first.text
    assert first.json()["tenant"]["accessUntil"] != registered["accessUntil"]
    second = await client.post("/api/saas/admin/tenants/clinic-a/renew", headers=ADMIN, json=body)
    assert second.json()["duplicate"] is True
    assert second.json()["paymentId"] == first.json()["paymentId"]
    assert second.json()["tenant"]["accessUntil"] == first.json()["tenant"]["accessUntil"]
    assert (
        await client.post(
            "/api/saas/admin/tenants/clinic-a/renew", headers=ADMIN, json={**body, "amount": "1.00"}
        )
    ).status_code == 409
    revision = first.json()["tenant"]["revision"]
    await client.put(
        "/api/saas/admin/tenants/clinic-a/suspension",
        headers=ADMIN,
        json={"revision": revision, "suspended": True, "reason": "Manual suspension"},
    )
    renewed = await client.post(
        "/api/saas/admin/tenants/clinic-a/renew",
        headers=ADMIN,
        json={**body, "reference": "bank-101"},
    )
    assert renewed.json()["tenant"]["status"] == "suspended"
    async with session_factory() as session:
        assert len((await session.scalars(select(SaaSPayment))).all()) == 2


def test_calendar_month_anchor_survives_february_and_year_boundary():
    january = datetime.fromisoformat("2028-01-31T03:00:00+03:00")
    february = add_calendar_months(january, 1, 31)
    march = add_calendar_months(february, 1, 31)
    assert february == datetime(2028, 2, 29, tzinfo=UTC)
    assert march == datetime(2028, 3, 31, tzinfo=UTC)
    assert add_calendar_months(datetime(2026, 12, 31, tzinfo=UTC), 1, 31).month == 1


async def test_scheduled_module_change_applies_without_scheduler(client, session_factory):
    await register(client, modules=["core", "patients", "billing"])
    future = datetime.now(UTC) + timedelta(days=1)
    response = await client.put(
        "/api/saas/admin/tenants/clinic-a/modules",
        headers=ADMIN,
        json={"revision": 1, "modules": ["core", "patients"], "effectiveAt": future.isoformat()},
    )
    assert "billing" in response.json()["modules"]
    async with session_factory() as session:
        tenant = await session.get(SaaSTenant, "clinic-a")
        tenant.scheduled_at = datetime.now(UTC) - timedelta(seconds=1)
        await session.commit()
    assert (
        "billing"
        not in (await client.get("/api/saas/access/clinic-a", headers=READER)).json()["modules"]
    )


async def test_offline_license_is_explicit_bound_and_idempotent(client, monkeypatch, tmp_path):
    from app.licensing.activation import verify_activation_request
    from app.licensing.decision import evaluate_license
    from app.licensing.issuer import Ed25519LicenseSigner
    from tests.test_activation_request import request

    seed = bytes(range(32))
    key_path = tmp_path / "issuer.seed"
    key_path.write_bytes(seed)
    monkeypatch.setattr(get_settings(), "saas_issuer_seed_path", key_path)
    signer = Ed25519LicenseSigner(get_settings().saas_issuer_key_id, seed)
    await register(client, mode="offline")
    activation = request()
    body = {"activationRequest": activation}
    first = await client.post("/api/saas/admin/tenants/clinic-a/license", headers=ADMIN, json=body)
    assert first.status_code == 200, first.text
    second = await client.post("/api/saas/admin/tenants/clinic-a/license", headers=ADMIN, json=body)
    assert first.json() == second.json()
    decision = evaluate_license(
        license=json.dumps(first.json()),
        product_id="dental-erp",
        installation_id=verify_activation_request(activation).installation_id,
        public_keys={signer.key_id: signer.public_key_pem()},
        now=datetime.now(UTC),
    )
    assert decision.state == "active"
    assert set(decision.payload.entitlements) == {"module:core", "module:patients"}
    assert decision.payload.customer_id == "customer-clinic-a"
    await register(client, "clinic-b", mode="offline")
    stolen = await client.post("/api/saas/admin/tenants/clinic-b/license", headers=ADMIN, json=body)
    assert stolen.status_code == 409


async def test_migration_access_suspend_restore_and_first_payment(client):
    response = await client.post(
        "/api/saas/admin/tenants",
        headers=ADMIN,
        json=clinic(accessUntil=None, migrationAccess=True),
    )
    assert response.status_code == 201
    assert response.json()["status"] == "migration"
    await client.put(
        "/api/saas/admin/tenants/clinic-a/suspension",
        headers=ADMIN,
        json={"revision": 1, "suspended": True, "reason": "Manual suspension"},
    )
    restored = await client.put(
        "/api/saas/admin/tenants/clinic-a/suspension",
        headers=ADMIN,
        json={"revision": 2, "suspended": False, "reason": "Restore migration access"},
    )
    assert restored.json()["status"] == "migration"
    assert restored.json()["allowsWrite"] is True
    paid = await client.post(
        "/api/saas/admin/tenants/clinic-a/renew",
        headers=ADMIN,
        json={"reference": "first-month", "months": 1, "amount": "1000.00"},
    )
    assert paid.json()["tenant"]["status"] == "active"
    assert paid.json()["tenant"]["accessUntil"] is not None


async def test_direct_backend_routes_check_modules_and_existing_session_suspension(
    client,
    session_factory,
    monkeypatch,
):
    from app.security.permissions import PermissionKey
    from tests.test_patient_slice import create_identity, login

    hospital_id, email = await create_identity(
        session_factory, role_name="SAAS_ADMIN", grants=set(PermissionKey)
    )
    body = clinic(str(hospital_id), slug="saas-admin", modules=["core", "patients"])
    assert (
        await client.post("/api/saas/admin/tenants", headers=ADMIN, json=body)
    ).status_code == 201
    monkeypatch.setattr(get_settings(), "saas_enforcement", "hosted")
    token = (await login(client, email))["accessToken"]
    identity = {"Authorization": f"Bearer {token}"}
    assert (await client.get("/api/patients", headers=identity)).status_code == 200
    assert (await client.get("/api/invoices", headers=identity)).status_code == 403
    await client.put(
        f"/api/saas/admin/tenants/{hospital_id}/suspension",
        headers=ADMIN,
        json={"revision": 1, "suspended": True, "reason": "Subscription held"},
    )
    blocked = await client.post(
        "/api/patients",
        headers=identity,
        json={"firstName": "Test", "lastName": "Patient", "phone": "+251911123456"},
    )
    assert blocked.status_code == 423
    assert (await client.get("/api/patients", headers=identity)).status_code == 200

async def test_client_options_default_deny_and_owner_only_revisioned_grants(client):
    created = await register(client)
    denied = {"recoveryRead": False, "backupExport": False, "licenseImport": False}
    assert created["clientOptions"] == denied
    body = {"revision": created["revision"], "clientOptions": {**denied, "backupExport": True}}
    assert (await client.put('/api/saas/admin/tenants/clinic-a/client-options', headers=READER, json=body)).status_code == 401
    granted = await client.put('/api/saas/admin/tenants/clinic-a/client-options', headers=ADMIN, json=body)
    assert granted.status_code == 200
    assert granted.json()["clientOptions"]["backupExport"] is True
    assert (await client.put('/api/saas/admin/tenants/clinic-a/client-options', headers=ADMIN, json=body)).status_code == 409
    changed = await client.put('/api/saas/admin/tenants/clinic-a/client-options', headers=ADMIN, json={"revision": granted.json()["revision"], "clientOptions": denied})
    assert changed.json()["clientOptions"] == denied
    other = await register(client, 'clinic-b')
    assert other["clientOptions"] == denied
    history = (await client.get('/api/saas/admin/tenants/clinic-a/history', headers=ADMIN)).json()
    assert any(e['action'] == 'CLIENT_OPTIONS' for e in history['events'])
