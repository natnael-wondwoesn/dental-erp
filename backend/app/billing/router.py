import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.billing.schemas import ClaimCreate, InsurancePolicyCreate, InvoiceCreate, PaymentCreate
from app.billing.workflow import BillingWorkflow
from app.database import get_session
from app.models import InsuranceClaim, InsurancePolicy, Invoice, InvoiceLine, Patient, Payment
from app.security.dependencies import Principal, require_permission
from app.security.permissions import PermissionKey

router = APIRouter(tags=["billing"])
Session = Annotated[AsyncSession, Depends(get_session)]
CanRead = Annotated[Principal, Depends(require_permission(PermissionKey.BILLING_READ))]
CanManage = Annotated[Principal, Depends(require_permission(PermissionKey.BILLING_MANAGE))]
CanPay = Annotated[Principal, Depends(require_permission(PermissionKey.PAYMENTS_POST))]
CanInsure = Annotated[Principal, Depends(require_permission(PermissionKey.INSURANCE_MANAGE))]


def module(session: AsyncSession, principal: Principal) -> BillingWorkflow:
    return BillingWorkflow(session, principal.hospital_id, principal.user_id)


def serialize(record) -> dict:
    return {column.name: getattr(record, column.name) for column in record.__table__.columns}


@router.get("/api/invoices")
async def list_invoices(principal: CanRead, session: Session, patient_id: uuid.UUID | None = None) -> dict:
    filters = [Invoice.hospital_id == principal.hospital_id]
    if patient_id:
        filters.append(Invoice.patient_id == patient_id)
    records = list((await session.scalars(select(Invoice).where(*filters).order_by(Invoice.issued_at.desc()))).all())
    return {"invoices": [serialize(record) for record in records]}


@router.post("/api/invoices", status_code=status.HTTP_201_CREATED)
async def create_invoice(payload: InvoiceCreate, principal: CanManage, session: Session) -> dict:
    return serialize(await module(session, principal).create_invoice(payload))


@router.get("/api/invoices/{invoice_id}")
async def get_invoice(invoice_id: uuid.UUID, principal: CanRead, session: Session) -> dict:
    invoice = await module(session, principal).invoice(invoice_id)
    lines = list((await session.scalars(select(InvoiceLine).where(InvoiceLine.invoice_id == invoice.id, InvoiceLine.hospital_id == principal.hospital_id))).all())
    patient = await session.scalar(select(Patient).where(Patient.id == invoice.patient_id, Patient.hospital_id == principal.hospital_id))
    return {**serialize(invoice), "items": [serialize(line) for line in lines], "patient": serialize(patient) if patient else None}


@router.get("/api/payments")
async def list_payments(principal: CanRead, session: Session, patient_id: uuid.UUID | None = None) -> dict:
    filters = [Payment.hospital_id == principal.hospital_id]
    if patient_id:
        filters.append(Payment.patient_id == patient_id)
    records = list((await session.scalars(select(Payment).where(*filters).order_by(Payment.received_at.desc()))).all())
    return {"payments": [serialize(record) for record in records]}


@router.post("/api/payments", status_code=status.HTTP_201_CREATED)
async def post_payment(payload: PaymentCreate, principal: CanPay, session: Session) -> dict:
    return serialize(await module(session, principal).post_payment(payload))


@router.post("/api/invoices/{invoice_id}/payments", status_code=status.HTTP_201_CREATED)
async def post_invoice_payment(invoice_id: uuid.UUID, payload: PaymentCreate, principal: CanPay, session: Session) -> dict:
    return serialize(await module(session, principal).post_payment(payload.model_copy(update={"invoice_id": invoice_id})))


@router.get("/api/insurance/policies")
async def list_policies(principal: CanRead, session: Session, patient_id: uuid.UUID | None = None) -> dict:
    filters = [InsurancePolicy.hospital_id == principal.hospital_id]
    if patient_id:
        filters.append(InsurancePolicy.patient_id == patient_id)
    records = list((await session.scalars(select(InsurancePolicy).where(*filters))).all())
    return {"policies": [serialize(record) for record in records]}


@router.post("/api/insurance/policies", status_code=status.HTTP_201_CREATED)
async def create_policy(payload: InsurancePolicyCreate, principal: CanInsure, session: Session) -> dict:
    return serialize(await module(session, principal).policy(payload))


@router.get("/api/insurance/claims")
async def list_claims(principal: CanRead, session: Session) -> dict:
    records = list((await session.scalars(select(InsuranceClaim).where(InsuranceClaim.hospital_id == principal.hospital_id).order_by(InsuranceClaim.submitted_at.desc()))).all())
    return {"claims": [serialize(record) for record in records]}


@router.post("/api/insurance/claims", status_code=status.HTTP_201_CREATED)
async def create_claim(payload: ClaimCreate, principal: CanInsure, session: Session) -> dict:
    return serialize(await module(session, principal).claim(payload))
