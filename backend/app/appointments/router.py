import math
import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.appointments.schemas import AppointmentCreate, AppointmentList, AppointmentUpdate, AppointmentView, Pagination, SlotResponse
from app.appointments.workflow import AppointmentWorkflow
from app.database import get_session
from app.security.dependencies import Principal, require_permission
from app.security.permissions import PermissionKey

router = APIRouter(prefix="/api/appointments", tags=["appointments"])
Session = Annotated[AsyncSession, Depends(get_session)]
CanRead = Annotated[Principal, Depends(require_permission(PermissionKey.APPOINTMENTS_READ))]
CanManage = Annotated[Principal, Depends(require_permission(PermissionKey.APPOINTMENTS_MANAGE))]


def workflow(session: AsyncSession, principal: Principal) -> AppointmentWorkflow:
    return AppointmentWorkflow(session, principal.hospital_id, principal.user_id, principal.timezone)


@router.get("/slots", response_model=SlotResponse)
async def slots(principal: CanRead, session: Session, doctor_id: uuid.UUID, date_: Annotated[date, Query(alias="date")], duration: Annotated[int, Query(ge=10, le=480)] = 30) -> SlotResponse:
    return SlotResponse(available=True, slots=await workflow(session, principal).slots(doctor_id, date_, duration))


@router.get("", response_model=AppointmentList)
async def list_appointments(principal: CanRead, session: Session, page: Annotated[int, Query(ge=1)] = 1, limit: Annotated[int, Query(ge=1, le=100)] = 10, search: str = "", status_filter: Annotated[str | None, Query(alias="status")] = None, type_filter: Annotated[str | None, Query(alias="type")] = None, date_filter: Annotated[date | None, Query(alias="date")] = None) -> AppointmentList:
    items, total = await workflow(session, principal).list(page, limit, search, status_filter, type_filter, date_filter)
    views = [await workflow(session, principal).view(item) for item in items]
    return AppointmentList(appointments=views, pagination=Pagination(page=page, limit=limit, total=total, total_pages=math.ceil(total / limit) if total else 0))


@router.post("", response_model=AppointmentView, status_code=status.HTTP_201_CREATED)
async def create_appointment(payload: AppointmentCreate, principal: CanManage, session: Session) -> AppointmentView:
    module = workflow(session, principal)
    return await module.view(await module.create(payload))


@router.get("/{appointment_id}", response_model=AppointmentView)
async def get_appointment(appointment_id: uuid.UUID, principal: CanRead, session: Session) -> AppointmentView:
    module = workflow(session, principal)
    return await module.view(await module._get(appointment_id))


@router.put("/{appointment_id}", response_model=AppointmentView)
async def update_appointment(appointment_id: uuid.UUID, payload: AppointmentUpdate, principal: CanManage, session: Session) -> AppointmentView:
    module = workflow(session, principal)
    return await module.view(await module.update(appointment_id, payload))


@router.post("/{appointment_id}/check-in", response_model=AppointmentView)
async def check_in(appointment_id: uuid.UUID, principal: CanManage, session: Session) -> AppointmentView:
    module = workflow(session, principal)
    return await module.view(await module.transition(appointment_id, "check-in"))


@router.post("/{appointment_id}/check-out", response_model=AppointmentView)
async def check_out(appointment_id: uuid.UUID, principal: CanManage, session: Session) -> AppointmentView:
    module = workflow(session, principal)
    return await module.view(await module.transition(appointment_id, "check-out"))
