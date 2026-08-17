import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import Field, model_validator

from app.schemas import ApiSchema


class InvoiceLineCreate(ApiSchema):
    clinical_procedure_id: uuid.UUID | None = None
    description: str = Field(min_length=2, max_length=255)
    quantity: int = Field(default=1, ge=1, le=100)
    unit_price: Decimal = Field(ge=0, max_digits=14, decimal_places=2)


class InvoiceCreate(ApiSchema):
    patient_id: uuid.UUID
    lines: list[InvoiceLineCreate] = Field(min_length=1)
    discount_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    tax_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    due_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=4000)

    @model_validator(mode="after")
    def valid_total(self) -> "InvoiceCreate":
        subtotal = sum((line.unit_price * line.quantity for line in self.lines), Decimal("0"))
        if self.discount_amount > subtotal + self.tax_amount:
            raise ValueError("Discount cannot exceed invoice value")
        return self


class PaymentCreate(ApiSchema):
    invoice_id: uuid.UUID | None = None
    patient_id: uuid.UUID | None = None
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    method: str = Field(pattern="^(CASH|TELEBIRR|CBE_BIRR|BANK_TRANSFER|CARD|INSURANCE)$")
    reference: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)


class InsurancePolicyCreate(ApiSchema):
    patient_id: uuid.UUID
    provider_name: str = Field(min_length=2, max_length=180)
    policy_number: str = Field(min_length=2, max_length=100)
    member_number: str | None = Field(default=None, max_length=100)
    coverage_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    valid_from: date | None = None
    valid_until: date | None = None


class ClaimCreate(ApiSchema):
    patient_id: uuid.UUID
    invoice_id: uuid.UUID
    policy_id: uuid.UUID
    claimed_amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
