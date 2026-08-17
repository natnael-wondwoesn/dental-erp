import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import Field

from app.schemas import ApiSchema


class AssessmentCreate(ApiSchema):
    patient_id: uuid.UUID
    appointment_id: uuid.UUID | None = None
    dentist_id: uuid.UUID | None = None
    chief_complaint: str = Field(min_length=2, max_length=4000)
    examination: str = Field(min_length=2, max_length=8000)
    vital_signs: dict = Field(default_factory=dict)


class DiagnosisCreate(ApiSchema):
    assessment_id: uuid.UUID
    code: str | None = Field(default=None, max_length=30)
    description: str = Field(min_length=2, max_length=255)
    tooth_number: str | None = Field(default=None, pattern="^(1[1-8]|2[1-8]|3[1-8]|4[1-8])$")
    is_primary: bool = False


class ChartEntryCreate(ApiSchema):
    patient_id: uuid.UUID
    assessment_id: uuid.UUID | None = None
    tooth_number: str = Field(pattern="^(1[1-8]|2[1-8]|3[1-8]|4[1-8])$")
    surfaces: list[str] = Field(default_factory=list)
    condition: str = Field(min_length=2, max_length=80)
    notes: str | None = Field(default=None, max_length=2000)


class PlanItemCreate(ApiSchema):
    procedure_id: uuid.UUID | None = None
    procedure_name: str = Field(min_length=2, max_length=180)
    tooth_number: str | None = Field(default=None, pattern="^(1[1-8]|2[1-8]|3[1-8]|4[1-8])$")
    quantity: int = Field(default=1, ge=1, le=32)
    unit_price: Decimal = Field(gt=0, max_digits=14, decimal_places=2)


class TreatmentPlanCreate(ApiSchema):
    patient_id: uuid.UUID
    assessment_id: uuid.UUID | None = None
    title: str = Field(min_length=2, max_length=180)
    items: list[PlanItemCreate] = Field(min_length=1)


class ProcedureCreate(ApiSchema):
    patient_id: uuid.UUID
    appointment_id: uuid.UUID | None = None
    treatment_plan_item_id: uuid.UUID | None = None
    dentist_id: uuid.UUID | None = None
    procedure_name: str = Field(min_length=2, max_length=180)
    tooth_number: str | None = Field(default=None, pattern="^(1[1-8]|2[1-8]|3[1-8]|4[1-8])$")
    notes: str | None = Field(default=None, max_length=4000)
    fee: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    performed_at: datetime


class TreatmentNoteCreate(ApiSchema):
    patient_id: uuid.UUID
    appointment_id: uuid.UUID | None = None
    note_type: str = Field(default="PROGRESS", max_length=40)
    note: str = Field(min_length=2, max_length=8000)


class FollowUpCreate(ApiSchema):
    patient_id: uuid.UUID
    source_procedure_id: uuid.UUID | None = None
    due_at: datetime
    reason: str = Field(min_length=2, max_length=255)
    notes: str | None = Field(default=None, max_length=2000)


class ProcedureCatalogCreate(ApiSchema):
    code: str = Field(min_length=2, max_length=30)
    name: str = Field(min_length=2, max_length=180)
    name_am: str | None = Field(default=None, max_length=180)
    default_price: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    duration_minutes: int = Field(default=30, ge=5, le=480)
