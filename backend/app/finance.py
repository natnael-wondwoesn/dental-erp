import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.identifiers import next_document_number
from app.database import get_session
from app.models import ClinicalProcedure, DentistCommission, Expense, LedgerEntry, Staff
from app.schemas import ApiSchema
from app.security.dependencies import Principal, require_permission
from app.security.permissions import PermissionKey

router = APIRouter(prefix="/api/finance", tags=["finance"])
Session = Annotated[AsyncSession, Depends(get_session)]
CanRead = Annotated[Principal, Depends(require_permission(PermissionKey.FINANCE_READ))]
CanManage = Annotated[Principal, Depends(require_permission(PermissionKey.FINANCE_MANAGE))]


class ExpenseCreate(ApiSchema):
    category: str = Field(min_length=2, max_length=100)
    description: str = Field(min_length=2, max_length=255)
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    incurred_at: datetime
    vendor: str | None = Field(default=None, max_length=180)
    reference: str | None = Field(default=None, max_length=120)
    payment_method: str = Field(default="CASH", pattern="^(CASH|TELEBIRR|CBE_BIRR|BANK_TRANSFER|CARD)$")


class CommissionCreate(ApiSchema):
    dentist_id: uuid.UUID
    clinical_procedure_id: uuid.UUID | None = None
    period: str = Field(pattern="^\d{4}-(0[1-9]|1[0-2])$")
    basis_amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    rate: Decimal = Field(ge=0, le=100)


def serialize(record) -> dict:
    return {column.name: getattr(record, column.name) for column in record.__table__.columns}


async def ledger(session: AsyncSession, principal: Principal, *, entry_type: str, account: str, description: str, debit: Decimal, credit: Decimal, source_type: str, source_id: str) -> None:
    session.add(LedgerEntry(hospital_id=principal.hospital_id, entry_number=await next_document_number(session, hospital_id=principal.hospital_id, key="ledger", prefix="LED"), entry_type=entry_type, account=account, description=description, debit=debit, credit=credit, source_type=source_type, source_id=source_id, posted_at=datetime.now(UTC), posted_by=principal.user_id))


@router.get("/expenses")
async def expenses(principal: CanRead, session: Session) -> dict:
    records = list((await session.scalars(select(Expense).where(Expense.hospital_id == principal.hospital_id).order_by(Expense.incurred_at.desc()))).all())
    return {"expenses": [serialize(record) for record in records]}


@router.post("/expenses", status_code=status.HTTP_201_CREATED)
async def post_expense(payload: ExpenseCreate, principal: CanManage, session: Session) -> dict:
    record = Expense(hospital_id=principal.hospital_id, posted_by=principal.user_id, **payload.model_dump())
    session.add(record)
    await session.flush()
    await ledger(session, principal, entry_type="EXPENSE", account=payload.category, description=payload.description, debit=Decimal("0"), credit=payload.amount, source_type="EXPENSE", source_id=str(record.id))
    return serialize(record)


@router.get("/commissions")
async def commissions(principal: CanRead, session: Session, period: str | None = None) -> dict:
    filters = [DentistCommission.hospital_id == principal.hospital_id]
    if period:
        filters.append(DentistCommission.period == period)
    records = list((await session.scalars(select(DentistCommission).where(*filters).order_by(DentistCommission.created_at.desc()))).all())
    return {"commissions": [serialize(record) for record in records]}


@router.post("/commissions", status_code=status.HTTP_201_CREATED)
async def accrue_commission(payload: CommissionCreate, principal: CanManage, session: Session) -> dict:
    dentist = await session.scalar(select(Staff).where(Staff.id == payload.dentist_id, Staff.hospital_id == principal.hospital_id, Staff.title == "DENTIST", Staff.is_active.is_(True)))
    if not dentist:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dentist not found")
    if payload.clinical_procedure_id:
        procedure = await session.scalar(select(ClinicalProcedure.id).where(ClinicalProcedure.id == payload.clinical_procedure_id, ClinicalProcedure.hospital_id == principal.hospital_id, ClinicalProcedure.dentist_id == dentist.id))
        if not procedure:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Dentist procedure not found")
    amount = (payload.basis_amount * payload.rate / Decimal("100")).quantize(Decimal("0.01"))
    record = DentistCommission(hospital_id=principal.hospital_id, amount=amount, **payload.model_dump())
    session.add(record)
    await session.flush()
    await ledger(session, principal, entry_type="COMMISSION", account="DENTIST_COMMISSIONS", description=f"Commission for {dentist.name} ({payload.period})", debit=Decimal("0"), credit=amount, source_type="COMMISSION", source_id=str(record.id))
    return serialize(record)


@router.get("/cash-flow")
async def cash_flow(principal: CanRead, session: Session) -> dict:
    rows = list((await session.scalars(select(LedgerEntry).where(LedgerEntry.hospital_id == principal.hospital_id).order_by(LedgerEntry.posted_at.desc()))).all())
    inflow = sum((row.debit for row in rows if row.account in {"CASH", "TELEBIRR", "CBE_BIRR", "BANK_TRANSFER", "CARD", "INSURANCE"}), Decimal("0"))
    outflow = sum((row.credit for row in rows if row.entry_type in {"EXPENSE", "COMMISSION"}), Decimal("0"))
    return {"currency": principal.currency, "inflow": inflow, "outflow": outflow, "netCashFlow": inflow - outflow, "entries": [serialize(row) for row in rows]}
