import uuid
from datetime import date, datetime, time

from pydantic import Field, model_validator

from app.schemas import ApiSchema


class AppointmentCreate(ApiSchema):
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    scheduled_date: date
    scheduled_time: time
    duration: int = Field(default=30, ge=10, le=480)
    appointment_type: str = Field(min_length=2, max_length=120)
    priority: str = Field(default="NORMAL", pattern="^(LOW|NORMAL|HIGH|EMERGENCY)$")
    chair_number: int | None = Field(default=None, ge=1, le=100)
    chief_complaint: str | None = Field(default=None, max_length=1000)
    notes: str | None = Field(default=None, max_length=4000)
    is_virtual: bool = False


class AppointmentUpdate(ApiSchema):
    doctor_id: uuid.UUID | None = None
    scheduled_date: date | None = None
    scheduled_time: time | None = None
    duration: int | None = Field(default=None, ge=10, le=480)
    appointment_type: str | None = Field(default=None, min_length=2, max_length=120)
    status: str | None = Field(
        default=None,
        pattern="^(SCHEDULED|CONFIRMED|CHECKED_IN|IN_PROGRESS|COMPLETED|CANCELLED|NO_SHOW)$",
    )
    priority: str | None = Field(default=None, pattern="^(LOW|NORMAL|HIGH|EMERGENCY)$")
    chair_number: int | None = Field(default=None, ge=1, le=100)
    chief_complaint: str | None = Field(default=None, max_length=1000)
    notes: str | None = Field(default=None, max_length=4000)
    cancellation_reason: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def cancellation_needs_reason(self) -> "AppointmentUpdate":
        if self.status == "CANCELLED" and not self.cancellation_reason:
            raise ValueError("Cancellation reason is required")
        return self


class PersonSummary(ApiSchema):
    id: uuid.UUID
    first_name: str
    last_name: str
    phone: str | None = None
    email: str | None = None
    patient_id: str | None = None
    employee_id: str | None = None
    specialization: str | None = None


class AppointmentView(ApiSchema):
    id: uuid.UUID
    appointment_no: str
    scheduled_date: date
    scheduled_time: str
    scheduled_start: datetime
    scheduled_end: datetime
    duration: int
    chair_number: int | None
    appointment_type: str
    status: str
    priority: str
    chief_complaint: str | None
    notes: str | None
    checked_in_at: datetime | None
    checked_out_at: datetime | None
    wait_time: int | None
    cancelled_at: datetime | None = None
    cancellation_reason: str | None
    is_virtual: bool = False
    video_consultation_id: str | None = None
    created_at: datetime
    updated_at: datetime
    patient: PersonSummary
    doctor: PersonSummary
    treatments: list[dict] = Field(default_factory=list)
    reminders: list[dict] = Field(default_factory=list)


class Pagination(ApiSchema):
    page: int
    limit: int
    total: int
    total_pages: int


class AppointmentList(ApiSchema):
    appointments: list[AppointmentView]
    pagination: Pagination


class SlotView(ApiSchema):
    time: str
    available: bool


class SlotResponse(ApiSchema):
    available: bool
    slots: list[SlotView]
    reason: str | None = None
