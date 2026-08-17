import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clinical.schemas import AssessmentCreate, ChartEntryCreate, DiagnosisCreate, FollowUpCreate, ProcedureCatalogCreate, ProcedureCreate, TreatmentNoteCreate, TreatmentPlanCreate
from app.clinical.workflow import ClinicalWorkflow
from app.database import get_session
from app.models import ClinicalAssessment, ClinicalProcedure, DentalChartEntry, Diagnosis, FollowUp, ProcedureCatalog, TreatmentNote, TreatmentPlan, TreatmentPlanItem
from app.security.dependencies import Principal, require_permission
from app.security.permissions import PermissionKey

router = APIRouter(tags=["clinical"])
Session = Annotated[AsyncSession, Depends(get_session)]
CanRead = Annotated[Principal, Depends(require_permission(PermissionKey.CLINICAL_READ))]
CanWrite = Annotated[Principal, Depends(require_permission(PermissionKey.CLINICAL_WRITE))]
CanApprove = Annotated[Principal, Depends(require_permission(PermissionKey.TREATMENT_PLANS_APPROVE))]


def module(session: AsyncSession, principal: Principal) -> ClinicalWorkflow:
    return ClinicalWorkflow(session, principal.hospital_id, principal.user_id)


@router.get("/api/clinical/patients/{patient_id}/record")
async def patient_record(patient_id: uuid.UUID, principal: CanRead, session: Session) -> dict:
    await module(session, principal).patient_exists(patient_id)
    async def rows(model, *order):
        return list((await session.scalars(select(model).where(model.hospital_id == principal.hospital_id, model.patient_id == patient_id).order_by(*order))).all())
    assessments = await rows(ClinicalAssessment, ClinicalAssessment.assessed_at.desc())
    chart = await rows(DentalChartEntry, DentalChartEntry.recorded_at.desc())
    plans = await rows(TreatmentPlan, TreatmentPlan.created_at.desc())
    procedures = await rows(ClinicalProcedure, ClinicalProcedure.performed_at.desc())
    notes = await rows(TreatmentNote, TreatmentNote.created_at.desc())
    follow_ups = await rows(FollowUp, FollowUp.due_at.desc())
    return {"assessments": [serialize(x) for x in assessments], "dentalChart": [serialize(x) for x in chart], "treatmentPlans": [serialize(x) for x in plans], "procedures": [serialize(x) for x in procedures], "notes": [serialize(x) for x in notes], "followUps": [serialize(x) for x in follow_ups]}


def serialize(record) -> dict:
    return {column.name: getattr(record, column.name) for column in record.__table__.columns}


@router.post("/api/clinical/assessments", status_code=status.HTTP_201_CREATED)
async def create_assessment(payload: AssessmentCreate, principal: CanWrite, session: Session) -> dict:
    return serialize(await module(session, principal).assessment(payload))


@router.post("/api/clinical/diagnoses", status_code=status.HTTP_201_CREATED)
async def create_diagnosis(payload: DiagnosisCreate, principal: CanWrite, session: Session) -> dict:
    return serialize(await module(session, principal).diagnosis(payload))


@router.post("/api/clinical/dental-chart", status_code=status.HTTP_201_CREATED)
async def create_chart(payload: ChartEntryCreate, principal: CanWrite, session: Session) -> dict:
    return serialize(await module(session, principal).chart(payload))


@router.post("/api/treatment-plans", status_code=status.HTTP_201_CREATED)
async def create_plan(payload: TreatmentPlanCreate, principal: CanWrite, session: Session) -> dict:
    return serialize(await module(session, principal).plan(payload))


@router.post("/api/treatment-plans/{plan_id}/approve")
async def approve_plan(plan_id: uuid.UUID, principal: CanApprove, session: Session) -> dict:
    return serialize(await module(session, principal).approve(plan_id))


@router.post("/api/treatments", status_code=status.HTTP_201_CREATED)
async def create_procedure(payload: ProcedureCreate, principal: CanWrite, session: Session) -> dict:
    return serialize(await module(session, principal).procedure(payload))


@router.post("/api/clinical/notes", status_code=status.HTTP_201_CREATED)
async def create_note(payload: TreatmentNoteCreate, principal: CanWrite, session: Session) -> dict:
    return serialize(await module(session, principal).note(payload))


@router.post("/api/clinical/follow-ups", status_code=status.HTTP_201_CREATED)
async def create_follow_up(payload: FollowUpCreate, principal: CanWrite, session: Session) -> dict:
    return serialize(await module(session, principal).follow_up(payload))


@router.get("/api/procedures")
async def list_catalog(principal: CanRead, session: Session) -> dict:
    records = list((await session.scalars(select(ProcedureCatalog).where(ProcedureCatalog.hospital_id == principal.hospital_id, ProcedureCatalog.is_active.is_(True)).order_by(ProcedureCatalog.name))).all())
    return {"procedures": [serialize(record) for record in records]}


@router.post("/api/procedures", status_code=status.HTTP_201_CREATED)
async def create_catalog(payload: ProcedureCatalogCreate, principal: CanWrite, session: Session) -> dict:
    record = ProcedureCatalog(hospital_id=principal.hospital_id, **payload.model_dump())
    session.add(record)
    await session.flush()
    return serialize(record)
