import uuid
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clinical.schemas import AssessmentCreate, ChartEntryCreate, DiagnosisCreate, FollowUpCreate, ProcedureCreate, TreatmentNoteCreate, TreatmentPlanCreate
from app.common.identifiers import next_document_number
from app.models import ClinicalAssessment, ClinicalProcedure, DentalChartEntry, Diagnosis, FollowUp, Patient, TreatmentNote, TreatmentPlan, TreatmentPlanItem


class ClinicalWorkflow:
    """Longitudinal clinical record orchestration behind one tenant-safe Interface."""

    def __init__(self, session: AsyncSession, hospital_id: uuid.UUID, actor_id: uuid.UUID):
        self.session, self.hospital_id, self.actor_id = session, hospital_id, actor_id

    async def patient_exists(self, patient_id: uuid.UUID) -> None:
        exists = await self.session.scalar(select(Patient.id).where(Patient.id == patient_id, Patient.hospital_id == self.hospital_id, Patient.is_active.is_(True)))
        if not exists:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")

    async def assessment(self, payload: AssessmentCreate) -> ClinicalAssessment:
        await self.patient_exists(payload.patient_id)
        record = ClinicalAssessment(hospital_id=self.hospital_id, created_by=self.actor_id, **payload.model_dump())
        self.session.add(record)
        await self.session.flush()
        return record

    async def diagnosis(self, payload: DiagnosisCreate) -> Diagnosis:
        assessment = await self.session.scalar(select(ClinicalAssessment).where(ClinicalAssessment.id == payload.assessment_id, ClinicalAssessment.hospital_id == self.hospital_id))
        if not assessment:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found")
        record = Diagnosis(hospital_id=self.hospital_id, **payload.model_dump())
        self.session.add(record)
        await self.session.flush()
        return record

    async def chart(self, payload: ChartEntryCreate) -> DentalChartEntry:
        await self.patient_exists(payload.patient_id)
        record = DentalChartEntry(hospital_id=self.hospital_id, recorded_by=self.actor_id, **payload.model_dump())
        self.session.add(record)
        await self.session.flush()
        return record

    async def plan(self, payload: TreatmentPlanCreate) -> TreatmentPlan:
        await self.patient_exists(payload.patient_id)
        total = sum((item.unit_price * item.quantity for item in payload.items), Decimal("0"))
        plan = TreatmentPlan(hospital_id=self.hospital_id, patient_id=payload.patient_id, assessment_id=payload.assessment_id, plan_number=await next_document_number(self.session, hospital_id=self.hospital_id, key="treatment-plan", prefix="TP"), title=payload.title, estimated_total=total, created_by=self.actor_id)
        self.session.add(plan)
        await self.session.flush()
        self.session.add_all([TreatmentPlanItem(hospital_id=self.hospital_id, treatment_plan_id=plan.id, sequence=index, **item.model_dump()) for index, item in enumerate(payload.items, start=1)])
        await self.session.flush()
        return plan

    async def approve(self, plan_id: uuid.UUID) -> TreatmentPlan:
        plan = await self.session.scalar(select(TreatmentPlan).where(TreatmentPlan.id == plan_id, TreatmentPlan.hospital_id == self.hospital_id))
        if not plan:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Treatment plan not found")
        if plan.status != "DRAFT":
            raise HTTPException(status.HTTP_409_CONFLICT, "Only draft treatment plans can be approved")
        plan.status, plan.approved_at = "APPROVED", datetime.now(UTC)
        await self.session.flush()
        return plan

    async def procedure(self, payload: ProcedureCreate) -> ClinicalProcedure:
        await self.patient_exists(payload.patient_id)
        record = ClinicalProcedure(hospital_id=self.hospital_id, created_by=self.actor_id, **payload.model_dump())
        self.session.add(record)
        if payload.treatment_plan_item_id:
            item = await self.session.scalar(select(TreatmentPlanItem).where(TreatmentPlanItem.id == payload.treatment_plan_item_id, TreatmentPlanItem.hospital_id == self.hospital_id))
            if not item:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Treatment plan item not found")
            item.status = "COMPLETED"
        await self.session.flush()
        return record

    async def note(self, payload: TreatmentNoteCreate) -> TreatmentNote:
        await self.patient_exists(payload.patient_id)
        record = TreatmentNote(hospital_id=self.hospital_id, author_id=self.actor_id, **payload.model_dump())
        self.session.add(record)
        await self.session.flush()
        return record

    async def follow_up(self, payload: FollowUpCreate) -> FollowUp:
        await self.patient_exists(payload.patient_id)
        record = FollowUp(hospital_id=self.hospital_id, assigned_to=self.actor_id, **payload.model_dump())
        self.session.add(record)
        await self.session.flush()
        return record
