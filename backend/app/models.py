import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()


role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column(
        "role_id",
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "permission_id",
        UUID(as_uuid=True),
        ForeignKey("permissions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

user_roles = Table(
    "user_roles",
    Base.metadata,
    Column(
        "user_id",
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "role_id",
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Hospital(Base):
    __tablename__ = "hospitals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(180))
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    locale: Mapped[str] = mapped_column(String(20), default="en-IN")
    country: Mapped[str] = mapped_column(String(2), default="IN")
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata")
    patient_limit: Mapped[int] = mapped_column(Integer, default=100)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class DocumentSequence(Base):
    """Atomic, tenant-scoped allocator for human-readable business identifiers."""

    __tablename__ = "document_sequences"
    __table_args__ = (UniqueConstraint("hospital_id", "key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True
    )
    key: Mapped[str] = mapped_column(String(40))
    value: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    key: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(String(255))


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    description: Mapped[str] = mapped_column(String(255))
    permissions: Mapped[list[Permission]] = relationship(
        secondary=role_permissions, lazy="selectin"
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True
    )
    email: Mapped[str] = mapped_column(String(320), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(180))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_hospital_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    roles: Mapped[list[Role]] = relationship(secondary=user_roles, lazy="selectin")


class Staff(Base):
    __tablename__ = "staff"
    __table_args__ = (
        UniqueConstraint("hospital_id", "employee_number"),
        Index("ix_staff_hospital_name", "hospital_id", "name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    employee_number: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(180))
    title: Mapped[str] = mapped_column(String(100))
    specialization: Mapped[str | None] = mapped_column(String(140))
    license_number: Mapped[str | None] = mapped_column(String(80))
    phone: Mapped[str | None] = mapped_column(String(32))
    commission_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0"))
    working_hours: Mapped[dict] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Gender(StrEnum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class BloodGroup(StrEnum):
    A_POSITIVE = "A_POSITIVE"
    A_NEGATIVE = "A_NEGATIVE"
    B_POSITIVE = "B_POSITIVE"
    B_NEGATIVE = "B_NEGATIVE"
    AB_POSITIVE = "AB_POSITIVE"
    AB_NEGATIVE = "AB_NEGATIVE"
    O_POSITIVE = "O_POSITIVE"
    O_NEGATIVE = "O_NEGATIVE"


class Patient(Base):
    __tablename__ = "patients"
    __table_args__ = (
        UniqueConstraint("hospital_id", "patient_number"),
        UniqueConstraint("hospital_id", "phone"),
        Index("ix_patients_hospital_name", "hospital_id", "first_name", "last_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True
    )
    patient_number: Mapped[str] = mapped_column(String(32))
    first_name: Mapped[str] = mapped_column(String(100))
    father_name: Mapped[str | None] = mapped_column(String(100))
    grandfather_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    age: Mapped[int | None] = mapped_column(Integer)
    gender: Mapped[Gender | None] = mapped_column(String(20))
    blood_group: Mapped[BloodGroup | None] = mapped_column(String(20))
    phone: Mapped[str] = mapped_column(String(32))
    alternate_phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(320))
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100), default="Addis Ababa")
    pincode: Mapped[str | None] = mapped_column(String(20))
    sub_city: Mapped[str | None] = mapped_column(String(100))
    woreda: Mapped[str | None] = mapped_column(String(40))
    kebele: Mapped[str | None] = mapped_column(String(40))
    landmark: Mapped[str | None] = mapped_column(String(180))
    preferred_language: Mapped[str] = mapped_column(String(10), default="am")
    occupation: Mapped[str | None] = mapped_column(String(120))
    emergency_contact_name: Mapped[str | None] = mapped_column(String(180))
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(32))
    emergency_contact_relation: Mapped[str | None] = mapped_column(String(80))
    medical_alerts: Mapped[list] = mapped_column(JSON, default=list)
    allergies: Mapped[list] = mapped_column(JSON, default=list)
    current_medications: Mapped[list] = mapped_column(JSON, default=list)
    consent_to_treatment: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_to_sms: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @property
    def patient_id(self) -> str:
        """Compatibility name used by the existing frontend payloads."""
        return self.patient_number


class PatientHistory(Base):
    __tablename__ = "patient_histories"
    __table_args__ = (Index("ix_patient_histories_patient_recorded", "patient_id", "recorded_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[str] = mapped_column(String(40))
    condition: Mapped[str] = mapped_column(String(180))
    details: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE")
    recorded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT")
    )
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PatientDocument(Base):
    __tablename__ = "patient_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(60))
    storage_key: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(120))
    size_bytes: Mapped[int] = mapped_column(Integer)
    checksum: Mapped[str] = mapped_column(String(64))
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        UniqueConstraint("hospital_id", "appointment_number"),
        Index("ix_appointments_hospital_start", "hospital_id", "scheduled_start"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"), index=True
    )
    dentist_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("staff.id", ondelete="RESTRICT"), index=True
    )
    appointment_number: Mapped[str] = mapped_column(String(32))
    dentist_name: Mapped[str] = mapped_column(String(180))
    appointment_type: Mapped[str] = mapped_column(String(120))
    priority: Mapped[str] = mapped_column(String(20), default="NORMAL")
    chief_complaint: Mapped[str | None] = mapped_column(Text)
    is_virtual: Mapped[bool] = mapped_column(Boolean, default=False)
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    scheduled_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    status: Mapped[str] = mapped_column(String(30), default="SCHEDULED", index=True)
    chair_label: Mapped[str | None] = mapped_column(String(60))
    notes: Mapped[str | None] = mapped_column(Text)
    cancellation_reason: Mapped[str | None] = mapped_column(Text)
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    checked_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    patient: Mapped[Patient] = relationship(lazy="joined")


class AppointmentEvent(Base):
    __tablename__ = "appointment_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True
    )
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"), index=True
    )
    event_type: Mapped[str] = mapped_column(String(40))
    old_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    new_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(Text)
    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClinicalAssessment(Base):
    __tablename__ = "clinical_assessments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"), index=True)
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), index=True)
    dentist_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id", ondelete="SET NULL"), index=True)
    chief_complaint: Mapped[str] = mapped_column(Text)
    examination: Mapped[str] = mapped_column(Text)
    vital_signs: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(30), default="OPEN")
    assessed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))


class Diagnosis(Base):
    __tablename__ = "diagnoses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    assessment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinical_assessments.id", ondelete="CASCADE"), index=True)
    code: Mapped[str | None] = mapped_column(String(30))
    description: Mapped[str] = mapped_column(String(255))
    tooth_number: Mapped[str | None] = mapped_column(String(10))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DentalChartEntry(Base):
    __tablename__ = "dental_chart_entries"
    __table_args__ = (Index("ix_chart_patient_tooth", "patient_id", "tooth_number"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), index=True)
    assessment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("clinical_assessments.id", ondelete="SET NULL"))
    tooth_number: Mapped[str] = mapped_column(String(10))
    surfaces: Mapped[list] = mapped_column(JSON, default=list)
    condition: Mapped[str] = mapped_column(String(80))
    notes: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProcedureCatalog(Base):
    __tablename__ = "procedure_catalog"
    __table_args__ = (UniqueConstraint("hospital_id", "code"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(180))
    name_am: Mapped[str | None] = mapped_column(String(180))
    default_price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class TreatmentPlan(Base):
    __tablename__ = "treatment_plans"
    __table_args__ = (UniqueConstraint("hospital_id", "plan_number"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"), index=True)
    assessment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("clinical_assessments.id", ondelete="SET NULL"))
    plan_number: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(String(30), default="DRAFT", index=True)
    estimated_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TreatmentPlanItem(Base):
    __tablename__ = "treatment_plan_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    treatment_plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("treatment_plans.id", ondelete="CASCADE"), index=True)
    procedure_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("procedure_catalog.id", ondelete="SET NULL"))
    procedure_name: Mapped[str] = mapped_column(String(180))
    tooth_number: Mapped[str | None] = mapped_column(String(10))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(String(30), default="PLANNED")
    sequence: Mapped[int] = mapped_column(Integer, default=1)


class ClinicalProcedure(Base):
    __tablename__ = "clinical_procedures"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"), index=True)
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"))
    treatment_plan_item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("treatment_plan_items.id", ondelete="SET NULL"))
    dentist_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id", ondelete="SET NULL"))
    procedure_name: Mapped[str] = mapped_column(String(180))
    tooth_number: Mapped[str | None] = mapped_column(String(10))
    notes: Mapped[str | None] = mapped_column(Text)
    fee: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(String(30), default="COMPLETED")
    performed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))


class TreatmentNote(Base):
    __tablename__ = "treatment_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), index=True)
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"))
    note_type: Mapped[str] = mapped_column(String(40), default="PROGRESS")
    note: Mapped[str] = mapped_column(Text)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FollowUp(Base):
    __tablename__ = "follow_ups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), index=True)
    source_procedure_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("clinical_procedures.id", ondelete="SET NULL"))
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    reason: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(30), default="DUE")
    notes: Mapped[str | None] = mapped_column(Text)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("hospital_id", "invoice_number"),
        Index("ix_invoices_hospital_issued", "hospital_id", "issued_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"), index=True
    )
    invoice_number: Mapped[str] = mapped_column(String(32))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    balance_due: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(String(30), default="ISSUED", index=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    clinical_procedure_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("clinical_procedures.id", ondelete="SET NULL"))
    description: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    line_total: Mapped[Decimal] = mapped_column(Numeric(14, 2))


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("hospital_id", "receipt_number"),
        Index("ix_payments_hospital_received", "hospital_id", "received_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"), index=True
    )
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="RESTRICT"), index=True
    )
    receipt_number: Mapped[str] = mapped_column(String(32))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    method: Mapped[str] = mapped_column(String(30))
    reference: Mapped[str | None] = mapped_column(String(120))
    notes: Mapped[str | None] = mapped_column(Text)
    posted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InsurancePolicy(Base):
    __tablename__ = "insurance_policies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), index=True)
    provider_name: Mapped[str] = mapped_column(String(180))
    policy_number: Mapped[str] = mapped_column(String(100))
    member_number: Mapped[str | None] = mapped_column(String(100))
    coverage_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0"))
    valid_from: Mapped[date | None] = mapped_column(Date)
    valid_until: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class InsuranceClaim(Base):
    __tablename__ = "insurance_claims"
    __table_args__ = (UniqueConstraint("hospital_id", "claim_number"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"), index=True)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="RESTRICT"), index=True)
    policy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("insurance_policies.id", ondelete="RESTRICT"))
    claim_number: Mapped[str] = mapped_column(String(32))
    claimed_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    approved_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(String(30), default="SUBMITTED", index=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LabVendor(Base):
    __tablename__ = "lab_vendors"
    __table_args__ = (UniqueConstraint("hospital_id", "name"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(180))
    phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(320))
    address: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class LabOrder(Base):
    __tablename__ = "lab_orders"
    __table_args__ = (
        UniqueConstraint("hospital_id", "order_number"),
        Index("ix_lab_orders_hospital_due", "hospital_id", "due_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"), index=True
    )
    order_number: Mapped[str] = mapped_column(String(32))
    appliance_type: Mapped[str] = mapped_column(String(120))
    vendor_name: Mapped[str] = mapped_column(String(180))
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_vendors.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(30), default="DRAFT", index=True)
    due_date: Mapped[date | None] = mapped_column(Date)
    cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    shade: Mapped[str | None] = mapped_column(String(40))
    tooth_numbers: Mapped[list] = mapped_column(JSON, default=list)
    instructions: Mapped[str | None] = mapped_column(Text)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LabOrderEvent(Base):
    __tablename__ = "lab_order_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    lab_order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_orders.id", ondelete="CASCADE"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(30))
    to_status: Mapped[str] = mapped_column(String(30))
    note: Mapped[str | None] = mapped_column(Text)
    actor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (Index("ix_expenses_hospital_incurred", "hospital_id", "incurred_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(255))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    vendor: Mapped[str | None] = mapped_column(String(180))
    reference: Mapped[str | None] = mapped_column(String(120))
    payment_method: Mapped[str] = mapped_column(String(30), default="CASH")
    status: Mapped[str] = mapped_column(String(30), default="POSTED")
    posted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    incurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DentistCommission(Base):
    __tablename__ = "dentist_commissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    dentist_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id", ondelete="RESTRICT"), index=True)
    clinical_procedure_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("clinical_procedures.id", ondelete="SET NULL"))
    period: Mapped[str] = mapped_column(String(7))
    basis_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(String(30), default="ACCRUED")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    __table_args__ = (Index("ix_ledger_hospital_posted", "hospital_id", "posted_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True)
    entry_number: Mapped[str] = mapped_column(String(32))
    entry_type: Mapped[str] = mapped_column(String(30))
    account: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(255))
    debit: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    credit: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    source_type: Mapped[str | None] = mapped_column(String(50))
    source_id: Mapped[str | None] = mapped_column(String(80))
    posted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    posted_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_entity", "entity_type", "entity_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hospitals.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    action: Mapped[str] = mapped_column(String(60))
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str] = mapped_column(String(80))
    old_values: Mapped[dict | None] = mapped_column(JSON)
    new_values: Mapped[dict | None] = mapped_column(JSON)
    ip_address: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
