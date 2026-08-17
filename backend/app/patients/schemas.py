import uuid
from datetime import date, datetime

from pydantic import EmailStr, Field, model_validator

from app.models import BloodGroup, Gender
from app.schemas import ApiSchema


class PatientCreate(ApiSchema):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=5, max_length=32)
    date_of_birth: date | None = None
    age: int | None = Field(default=None, ge=0, le=130)
    gender: Gender | None = None
    blood_group: BloodGroup | None = None
    alternate_phone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default="Tamil Nadu", max_length=100)
    pincode: str | None = Field(default=None, max_length=20)
    occupation: str | None = Field(default=None, max_length=120)
    emergency_contact_name: str | None = Field(default=None, max_length=180)
    emergency_contact_phone: str | None = Field(default=None, max_length=32)
    emergency_contact_relation: str | None = Field(default=None, max_length=80)

    @model_validator(mode="after")
    def require_age_or_birth_date(self) -> "PatientCreate":
        if self.age is None and self.date_of_birth is None:
            raise ValueError("Either age or dateOfBirth is required")
        return self


class PatientUpdate(ApiSchema):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, min_length=5, max_length=32)
    date_of_birth: date | None = None
    age: int | None = Field(default=None, ge=0, le=130)
    gender: Gender | None = None
    blood_group: BloodGroup | None = None
    alternate_phone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    pincode: str | None = Field(default=None, max_length=20)
    occupation: str | None = Field(default=None, max_length=120)
    emergency_contact_name: str | None = Field(default=None, max_length=180)
    emergency_contact_phone: str | None = Field(default=None, max_length=32)
    emergency_contact_relation: str | None = Field(default=None, max_length=80)


class PatientView(ApiSchema):
    id: uuid.UUID
    patient_id: str
    first_name: str
    last_name: str
    phone: str
    date_of_birth: date | None
    age: int | None
    gender: Gender | None
    blood_group: BloodGroup | None
    alternate_phone: str | None
    email: EmailStr | None
    address: str | None
    city: str | None
    state: str | None
    pincode: str | None
    occupation: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    emergency_contact_relation: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class Pagination(ApiSchema):
    page: int
    limit: int
    total: int
    total_pages: int


class PatientListResponse(ApiSchema):
    patients: list[PatientView]
    pagination: Pagination


class PatientDetailResponse(ApiSchema):
    success: bool = True
    patient: PatientView


class MessageResponse(ApiSchema):
    success: bool = True
    message: str
