import json
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException, status

from app.licensing.runtime import LicenseRuntime, RuntimeLicenseDecision, get_license_runtime
from app.security.dependencies import Principal, get_current_principal, require_permission
from app.security.permissions import PermissionKey

router = APIRouter(prefix="/api/license", tags=["license"])
CurrentPrincipal = Annotated[Principal, Depends(get_current_principal)]
LicenseAdmin = Annotated[
    Principal,
    Depends(require_permission(PermissionKey.LICENSE_MANAGE, enforce_license=False)),
]


@router.get("/status", response_model=RuntimeLicenseDecision)
async def license_status(
    _principal: CurrentPrincipal,
    runtime: Annotated[LicenseRuntime, Depends(get_license_runtime)],
) -> RuntimeLicenseDecision:
    return await runtime.decide()


@router.post("/import", response_model=RuntimeLicenseDecision)
async def import_license(
    _principal: LicenseAdmin,
    runtime: Annotated[LicenseRuntime, Depends(get_license_runtime)],
    license_document: Annotated[dict[str, Any], Body()],
) -> RuntimeLicenseDecision:
    try:
        return await runtime.import_license(
            json.dumps(license_document, separators=(",", ":"), ensure_ascii=False)
        )
    except (OSError, ValueError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "LICENSE_IMPORT_FAILED", "message": str(exc)},
        ) from exc
