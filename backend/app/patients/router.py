import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import add_audit_log
from app.database import get_session
from app.patients.schemas import (
    MessageResponse,
    Pagination,
    PatientCreate,
    PatientDetailResponse,
    PatientListResponse,
    PatientUpdate,
    PatientView,
)
from app.patients.workflow import PatientWorkflow
from app.security.dependencies import Principal, require_permission
from app.security.permissions import PermissionKey

router = APIRouter(prefix="/api/patients", tags=["patients"])
Session = Annotated[AsyncSession, Depends(get_session)]
CanRead = Annotated[Principal, Depends(require_permission(PermissionKey.PATIENTS_READ))]
CanCreate = Annotated[Principal, Depends(require_permission(PermissionKey.PATIENTS_CREATE))]
CanUpdate = Annotated[Principal, Depends(require_permission(PermissionKey.PATIENTS_UPDATE))]
CanArchive = Annotated[Principal, Depends(require_permission(PermissionKey.PATIENTS_ARCHIVE))]


@router.get("", response_model=PatientListResponse)
async def list_patients(
    principal: CanRead,
    session: Session,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 10,
    search: str = "",
    all: bool = False,
) -> PatientListResponse:
    result = await PatientWorkflow(session, principal.hospital_id).list(
        page=page, limit=limit, search=search, all_records=all
    )
    return PatientListResponse(
        patients=[PatientView.model_validate(patient) for patient in result.items],
        pagination=Pagination(
            page=result.page,
            limit=result.limit,
            total=result.total,
            total_pages=result.total_pages,
        ),
    )


@router.post("", response_model=PatientView, status_code=status.HTTP_201_CREATED)
async def create_patient(
    payload: PatientCreate,
    request: Request,
    principal: CanCreate,
    session: Session,
) -> PatientView:
    patient = await PatientWorkflow(session, principal.hospital_id).create(payload)
    view = PatientView.model_validate(patient)
    add_audit_log(
        session,
        principal=principal,
        request=request,
        action="CREATE",
        entity_type="Patient",
        entity_id=str(patient.id),
        new_values=view.model_dump(mode="json"),
    )
    return view


@router.get("/{patient_id}", response_model=PatientDetailResponse)
async def get_patient(
    patient_id: uuid.UUID, principal: CanRead, session: Session
) -> PatientDetailResponse:
    patient = await PatientWorkflow(session, principal.hospital_id).get(patient_id)
    return PatientDetailResponse(patient=PatientView.model_validate(patient))


@router.put("/{patient_id}", response_model=PatientDetailResponse)
async def update_patient(
    patient_id: uuid.UUID,
    payload: PatientUpdate,
    request: Request,
    principal: CanUpdate,
    session: Session,
) -> PatientDetailResponse:
    patient, before = await PatientWorkflow(session, principal.hospital_id).update(
        patient_id, payload
    )
    view = PatientView.model_validate(patient)
    add_audit_log(
        session,
        principal=principal,
        request=request,
        action="UPDATE",
        entity_type="Patient",
        entity_id=str(patient.id),
        old_values=before,
        new_values=view.model_dump(mode="json"),
    )
    return PatientDetailResponse(patient=view)


@router.delete("/{patient_id}", response_model=MessageResponse)
async def archive_patient(
    patient_id: uuid.UUID,
    request: Request,
    principal: CanArchive,
    session: Session,
) -> MessageResponse:
    patient, before = await PatientWorkflow(session, principal.hospital_id).archive(patient_id)
    add_audit_log(
        session,
        principal=principal,
        request=request,
        action="ARCHIVE",
        entity_type="Patient",
        entity_id=str(patient.id),
        old_values=before,
        new_values={"isActive": False},
    )
    return MessageResponse(message="Patient deactivated successfully")
