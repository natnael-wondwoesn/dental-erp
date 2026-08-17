import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.identifiers import next_document_number
from app.common.phone import normalize_ethiopian_phone
from app.database import get_session
from app.models import LabOrder, LabOrderEvent, LabVendor, Patient
from app.schemas import ApiSchema
from app.security.dependencies import Principal, require_permission
from app.security.permissions import PermissionKey

router = APIRouter(prefix="/api", tags=["laboratory"])
Session = Annotated[AsyncSession, Depends(get_session)]
CanRead = Annotated[Principal, Depends(require_permission(PermissionKey.LAB_READ))]
CanManage = Annotated[Principal, Depends(require_permission(PermissionKey.LAB_MANAGE))]

STATUS_ORDER = ("DRAFT", "SENT", "IN_PRODUCTION", "QUALITY_CHECK", "READY", "RECEIVED", "FITTED", "CANCELLED")


class VendorCreate(ApiSchema):
    name: str = Field(min_length=2, max_length=180)
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = Field(default=None, max_length=1000)


class LabOrderCreate(ApiSchema):
    patient_id: uuid.UUID
    vendor_id: uuid.UUID | None = None
    vendor_name: str = Field(min_length=2, max_length=180)
    appliance_type: str = Field(min_length=2, max_length=120)
    due_date: date | None = None
    cost: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    shade: str | None = Field(default=None, max_length=40)
    tooth_numbers: list[str] = Field(default_factory=list)
    instructions: str | None = Field(default=None, max_length=4000)


class StatusUpdate(ApiSchema):
    status: str
    note: str | None = Field(default=None, max_length=2000)


def serialize(record) -> dict:
    return {column.name: getattr(record, column.name) for column in record.__table__.columns}


@router.get("/lab-vendors")
async def vendors(principal: CanRead, session: Session) -> dict:
    records = list((await session.scalars(select(LabVendor).where(LabVendor.hospital_id == principal.hospital_id, LabVendor.is_active.is_(True)).order_by(LabVendor.name))).all())
    return {"vendors": [serialize(record) for record in records]}


@router.post("/lab-vendors", status_code=status.HTTP_201_CREATED)
async def create_vendor(payload: VendorCreate, principal: CanManage, session: Session) -> dict:
    record = LabVendor(hospital_id=principal.hospital_id, name=payload.name, phone=normalize_ethiopian_phone(payload.phone), email=str(payload.email) if payload.email else None, address=payload.address)
    session.add(record)
    await session.flush()
    return serialize(record)


@router.get("/lab-orders")
async def orders(principal: CanRead, session: Session, patient_id: uuid.UUID | None = None) -> dict:
    filters = [LabOrder.hospital_id == principal.hospital_id]
    if patient_id:
        filters.append(LabOrder.patient_id == patient_id)
    records = list((await session.scalars(select(LabOrder).where(*filters).order_by(LabOrder.created_at.desc()))).all())
    return {"orders": [serialize(record) for record in records]}


@router.post("/lab-orders", status_code=status.HTTP_201_CREATED)
async def create_order(payload: LabOrderCreate, principal: CanManage, session: Session) -> dict:
    patient = await session.scalar(select(Patient.id).where(Patient.id == payload.patient_id, Patient.hospital_id == principal.hospital_id, Patient.is_active.is_(True)))
    if not patient:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    if payload.vendor_id:
        vendor = await session.scalar(select(LabVendor).where(LabVendor.id == payload.vendor_id, LabVendor.hospital_id == principal.hospital_id, LabVendor.is_active.is_(True)))
        if not vendor:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Lab vendor not found")
    record = LabOrder(hospital_id=principal.hospital_id, order_number=await next_document_number(session, hospital_id=principal.hospital_id, key="lab-order", prefix="LAB"), **payload.model_dump())
    session.add(record)
    await session.flush()
    session.add(LabOrderEvent(hospital_id=principal.hospital_id, lab_order_id=record.id, to_status="DRAFT", actor_id=principal.user_id))
    return serialize(record)


@router.patch("/lab-orders/{order_id}/status")
async def update_status(order_id: uuid.UUID, payload: StatusUpdate, principal: CanManage, session: Session) -> dict:
    order = await session.scalar(select(LabOrder).where(LabOrder.id == order_id, LabOrder.hospital_id == principal.hospital_id).with_for_update())
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lab order not found")
    if payload.status not in STATUS_ORDER:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid lab status")
    current, target = STATUS_ORDER.index(order.status), STATUS_ORDER.index(payload.status)
    if payload.status != "CANCELLED" and target != current + 1:
        raise HTTPException(status.HTTP_409_CONFLICT, "Lab cases must progress one status at a time")
    previous = order.status
    order.status = payload.status
    now = datetime.now(UTC)
    if payload.status == "SENT":
        order.sent_at = now
    if payload.status == "RECEIVED":
        order.received_at = now
    session.add(LabOrderEvent(hospital_id=principal.hospital_id, lab_order_id=order.id, from_status=previous, to_status=payload.status, note=payload.note, actor_id=principal.user_id))
    await session.flush()
    return serialize(order)
