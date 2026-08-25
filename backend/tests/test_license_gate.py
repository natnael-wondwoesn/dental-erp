import uuid
from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient

from app.licensing.runtime import RuntimeLicenseDecision, get_license_runtime
from app.security.dependencies import Principal, get_current_principal, require_permission
from app.security.permissions import PermissionKey


class FixedRuntime:
    def __init__(self, *, enforcement: str, allows_write: bool):
        self.enforcement = enforcement
        self.allows_write = allows_write

    async def decide(self) -> RuntimeLicenseDecision:
        return RuntimeLicenseDecision(
            enforcement=self.enforcement,
            state="expired_read_only",
            reason="expired",
            allows_read=True,
            allows_write=self.allows_write,
            allows_recovery=True,
            product_id="dental-erp",
            installation_id="installation-test-01",
            expires_at="2026-08-31T23:59:59Z",
            entitlements=("core",),
        )


def principal() -> Principal:
    return Principal(
        user_id=uuid.uuid4(),
        hospital_id=uuid.uuid4(),
        email="admin@example.test",
        name="Clinic Administrator",
        roles=frozenset({"ADMIN"}),
        permissions=frozenset({PermissionKey.PATIENTS_CREATE}),
        clinic_name="Sunny Smile Speciality Clinic",
        currency="ETB",
        locale="en-ET",
        timezone="Africa/Addis_Ababa",
    )


def protected_app(runtime: FixedRuntime) -> FastAPI:
    test_app = FastAPI()

    @test_app.api_route("/record", methods=["GET", "POST"])
    async def record(
        _current: Annotated[Principal, Depends(require_permission(PermissionKey.PATIENTS_CREATE))],
    ) -> dict[str, bool]:
        return {"ok": True}

    test_app.dependency_overrides[get_current_principal] = principal
    test_app.dependency_overrides[get_license_runtime] = lambda: runtime
    return test_app


@pytest.mark.asyncio
async def test_required_expired_license_keeps_reads_and_blocks_writes() -> None:
    app = protected_app(FixedRuntime(enforcement="required", allows_write=False))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/record")).status_code == 200
        response = await client.post("/record")

    assert response.status_code == 423
    assert response.json()["detail"] == {
        "code": "LICENSE_WRITE_RESTRICTED",
        "state": "expired_read_only",
        "reason": "expired",
    }


@pytest.mark.asyncio
async def test_audit_mode_never_blocks_writes() -> None:
    app = protected_app(FixedRuntime(enforcement="audit", allows_write=False))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.post("/record")).status_code == 200
