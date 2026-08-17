import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.identifiers import next_document_number
from app.common.phone import normalize_ethiopian_phone
from app.database import get_session
from app.models import Staff
from app.schemas import ApiSchema
from app.security.dependencies import Principal, require_permission
from app.security.permissions import PermissionKey

router = APIRouter(prefix="/api/staff", tags=["staff"])
Session = Annotated[AsyncSession, Depends(get_session)]
CanRead = Annotated[Principal, Depends(require_permission(PermissionKey.STAFF_READ))]
CanManage = Annotated[Principal, Depends(require_permission(PermissionKey.STAFF_MANAGE))]


class StaffCreate(ApiSchema):
    name: str = Field(min_length=2, max_length=180)
    title: str = Field(min_length=2, max_length=100)
    specialization: str | None = Field(default=None, max_length=140)
    license_number: str | None = Field(default=None, max_length=80)
    phone: str | None = None
    commission_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    working_hours: dict = Field(default_factory=dict)


class StaffView(ApiSchema):
    id: uuid.UUID
    employee_id: str
    employee_number: str
    first_name: str
    last_name: str
    name: str
    title: str
    specialization: str | None
    license_number: str | None
    phone: str | None
    commission_rate: Decimal
    working_hours: dict
    is_active: bool


def view(member: Staff) -> StaffView:
    parts = member.name.split(maxsplit=1)
    return StaffView(
        id=member.id,
        employee_id=member.employee_number,
        employee_number=member.employee_number,
        first_name=parts[0],
        last_name=parts[1] if len(parts) > 1 else "",
        name=member.name,
        title=member.title,
        specialization=member.specialization,
        license_number=member.license_number,
        phone=member.phone,
        commission_rate=member.commission_rate,
        working_hours=member.working_hours,
        is_active=member.is_active,
    )


@router.get("")
async def list_staff(
    principal: CanRead,
    session: Session,
    role: Annotated[str | None, Query()] = None,
) -> dict:
    filters = [Staff.hospital_id == principal.hospital_id, Staff.is_active.is_(True)]
    if role == "DOCTOR":
        filters.append(Staff.title == "DENTIST")
    members = list((await session.scalars(select(Staff).where(*filters).order_by(Staff.name))).all())
    return {"staff": [view(member).model_dump(by_alias=True, mode="json") for member in members]}


@router.get("/doctors")
async def list_doctors(principal: CanRead, session: Session) -> dict:
    members = list((await session.scalars(select(Staff).where(Staff.hospital_id == principal.hospital_id, Staff.title == "DENTIST", Staff.is_active.is_(True)).order_by(Staff.name))).all())
    return {"doctors": [view(member).model_dump(by_alias=True, mode="json") for member in members]}


@router.post("", response_model=StaffView, status_code=status.HTTP_201_CREATED)
async def create_staff(payload: StaffCreate, principal: CanManage, session: Session) -> StaffView:
    member = Staff(
        hospital_id=principal.hospital_id,
        employee_number=await next_document_number(session, hospital_id=principal.hospital_id, key="staff", prefix="EMP", width=4),
        name=payload.name,
        title=payload.title.upper(),
        specialization=payload.specialization,
        license_number=payload.license_number,
        phone=normalize_ethiopian_phone(payload.phone),
        commission_rate=payload.commission_rate,
        working_hours=payload.working_hours,
    )
    session.add(member)
    await session.flush()
    return view(member)
