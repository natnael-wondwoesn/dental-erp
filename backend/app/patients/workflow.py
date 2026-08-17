import math
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.identifiers import next_document_number
from app.common.phone import normalize_ethiopian_phone
from app.models import Hospital, Patient
from app.patients.schemas import PatientCreate, PatientUpdate, PatientView


@dataclass(frozen=True)
class PatientPage:
    items: list[Patient]
    page: int
    limit: int
    total: int

    @property
    def total_pages(self) -> int:
        return math.ceil(self.total / self.limit) if self.total else 0


class PatientWorkflow:
    """Owns patient invariants, allocation, tenant scoping, and mutation semantics."""

    def __init__(self, session: AsyncSession, hospital_id: uuid.UUID):
        self.session = session
        self.hospital_id = hospital_id

    async def list(
        self,
        *,
        page: int,
        limit: int,
        search: str,
        all_records: bool,
    ) -> PatientPage:
        filters = [Patient.hospital_id == self.hospital_id, Patient.is_active.is_(True)]
        if search:
            pattern = f"%{search.strip()}%"
            filters.append(
                or_(
                    Patient.patient_number.ilike(pattern),
                    Patient.first_name.ilike(pattern),
                    Patient.last_name.ilike(pattern),
                    Patient.phone.ilike(pattern),
                    Patient.email.ilike(pattern),
                )
            )

        total = await self.session.scalar(select(func.count(Patient.id)).where(*filters))
        query = select(Patient).where(*filters).order_by(Patient.created_at.desc())
        if not all_records:
            query = query.offset((page - 1) * limit).limit(limit)
        items = list((await self.session.scalars(query)).all())
        return PatientPage(items=items, page=page, limit=limit, total=total or 0)

    async def get(self, patient_id: uuid.UUID) -> Patient:
        patient = await self.session.scalar(
            select(Patient).where(
                Patient.id == patient_id,
                Patient.hospital_id == self.hospital_id,
                Patient.is_active.is_(True),
            )
        )
        if patient is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
        return patient

    async def create(self, payload: PatientCreate) -> Patient:
        hospital = await self.session.scalar(
            select(Hospital)
            .where(Hospital.id == self.hospital_id, Hospital.is_active.is_(True))
            .with_for_update()
        )
        if hospital is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Clinic is inactive")

        patient_count = await self.session.scalar(
            select(func.count(Patient.id)).where(
                Patient.hospital_id == self.hospital_id,
                Patient.is_active.is_(True),
            )
        )
        if hospital.patient_limit != -1 and (patient_count or 0) >= hospital.patient_limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "Patient limit reached",
                    "current": patient_count or 0,
                    "max": hospital.patient_limit,
                },
            )

        values = payload.model_dump()
        values["phone"] = normalize_ethiopian_phone(values["phone"])
        values["alternate_phone"] = normalize_ethiopian_phone(values.get("alternate_phone"))
        values["emergency_contact_phone"] = normalize_ethiopian_phone(
            values.get("emergency_contact_phone")
        )
        patient = Patient(
            hospital_id=self.hospital_id,
            patient_number=await self._next_patient_number(),
            **values,
        )
        self.session.add(patient)
        try:
            await self.session.flush()
        except IntegrityError as exc:
            await self.session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A patient with this phone number already exists",
            ) from exc
        return patient

    async def update(self, patient_id: uuid.UUID, payload: PatientUpdate) -> tuple[Patient, dict]:
        patient = await self.get(patient_id)
        before = PatientView.model_validate(patient).model_dump(mode="json")
        changes = payload.model_dump(exclude_unset=True)
        for key in ("phone", "alternate_phone", "emergency_contact_phone"):
            if key in changes:
                changes[key] = normalize_ethiopian_phone(changes[key])
        for field, value in changes.items():
            setattr(patient, field, value)
        patient.updated_at = datetime.now(UTC)
        try:
            await self.session.flush()
        except IntegrityError as exc:
            await self.session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A patient with this phone number already exists",
            ) from exc
        return patient, before

    async def archive(self, patient_id: uuid.UUID) -> tuple[Patient, dict]:
        patient = await self.get(patient_id)
        before = PatientView.model_validate(patient).model_dump(mode="json")
        patient.is_active = False
        patient.updated_at = datetime.now(UTC)
        await self.session.flush()
        return patient, before

    async def _next_patient_number(self) -> str:
        return await next_document_number(
            self.session,
            hospital_id=self.hospital_id,
            key="patient",
            prefix="ET-PAT",
            width=5,
        )
