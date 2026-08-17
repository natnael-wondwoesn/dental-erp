from collections import defaultdict
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models import Appointment, Expense, Invoice, LabOrder, Patient, Payment
from app.schemas import ApiSchema
from app.security.dependencies import Principal, require_permission
from app.security.permissions import PermissionKey

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])
Session = Annotated[AsyncSession, Depends(get_session)]
CanReadDashboard = Annotated[Principal, Depends(require_permission(PermissionKey.DASHBOARD_READ))]


class Overview(ApiSchema):
    total_patients: int
    new_patients_this_month: int
    patient_growth: float
    today_appointments: int
    this_month_appointments: int
    appointment_growth: float
    pending_appointments: int
    completed_appointments_today: int
    waiting_patients: int
    this_month_revenue: Decimal
    today_revenue: Decimal
    revenue_growth: float
    pending_payments: Decimal
    total_revenue: Decimal
    month_expenses: Decimal
    net_cash_flow: Decimal
    active_lab_orders: int


class RevenuePoint(ApiSchema):
    date: str
    revenue: Decimal


class StatusPoint(ApiSchema):
    status: str
    count: int


class AppointmentItem(ApiSchema):
    id: str
    patient_name: str
    patient_number: str
    doctor_name: str
    date: datetime
    type: str
    status: str
    chair_label: str | None = None


class LabAlert(ApiSchema):
    id: str
    order_number: str
    appliance_type: str
    vendor_name: str
    due_date: str | None
    status: str


class Charts(ApiSchema):
    last_7_days_revenue: list[RevenuePoint]
    appointments_by_status: list[StatusPoint]


class RecentActivity(ApiSchema):
    upcoming_appointments: list[AppointmentItem]
    lab_alerts: list[LabAlert]


class DashboardResponse(ApiSchema):
    overview: Overview
    charts: Charts
    recent_activity: RecentActivity
    currency: str = "ETB"
    timezone: str = "Africa/Addis_Ababa"
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


def _month_start(value: datetime) -> datetime:
    return value.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


@router.get("/stats", response_model=DashboardResponse)
async def dashboard_stats(
    principal: CanReadDashboard,
    session: Session,
) -> DashboardResponse:
    addis = ZoneInfo("Africa/Addis_Ababa")
    now = datetime.now(addis)
    today_start = datetime.combine(now.date(), time.min, tzinfo=addis)
    tomorrow_start = today_start + timedelta(days=1)
    month_start = _month_start(now)
    previous_month_start = _month_start(month_start - timedelta(days=1))
    seven_days_start = today_start - timedelta(days=6)
    hospital_filter = principal.hospital_id

    async def count(model, *conditions) -> int:
        value = await session.scalar(
            select(func.count(model.id)).where(model.hospital_id == hospital_filter, *conditions)
        )
        return int(value or 0)

    total_patients = await count(Patient, Patient.is_active.is_(True))
    new_patients = await count(
        Patient, Patient.is_active.is_(True), Patient.created_at >= month_start
    )
    previous_new_patients = await count(
        Patient,
        Patient.is_active.is_(True),
        Patient.created_at >= previous_month_start,
        Patient.created_at < month_start,
    )
    today_appointments = await count(
        Appointment,
        Appointment.scheduled_start >= today_start,
        Appointment.scheduled_start < tomorrow_start,
    )
    this_month_appointments = await count(Appointment, Appointment.scheduled_start >= month_start)
    previous_month_appointments = await count(
        Appointment,
        Appointment.scheduled_start >= previous_month_start,
        Appointment.scheduled_start < month_start,
    )
    completed_today = await count(
        Appointment,
        Appointment.scheduled_start >= today_start,
        Appointment.scheduled_start < tomorrow_start,
        Appointment.status == "COMPLETED",
    )
    pending_today = await count(
        Appointment,
        Appointment.scheduled_start >= today_start,
        Appointment.scheduled_start < tomorrow_start,
        Appointment.status.in_(["SCHEDULED", "CONFIRMED"]),
    )
    waiting_patients = await count(
        Appointment,
        Appointment.scheduled_start >= today_start,
        Appointment.scheduled_start < tomorrow_start,
        Appointment.status.in_(["CHECKED_IN", "IN_CHAIR"]),
    )
    active_lab_orders = await count(LabOrder, LabOrder.status.not_in(["DELIVERED", "CANCELLED"]))

    payments = list(
        (
            await session.scalars(
                select(Payment).where(
                    Payment.hospital_id == hospital_filter,
                    Payment.received_at >= seven_days_start,
                )
            )
        ).all()
    )
    month_payments = [p for p in payments if p.received_at.replace(tzinfo=addis) >= month_start]
    today_payments = [p for p in payments if p.received_at.replace(tzinfo=addis) >= today_start]
    previous_month_revenue = await session.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.hospital_id == hospital_filter,
            Payment.received_at >= previous_month_start,
            Payment.received_at < month_start,
        )
    )
    total_revenue = await session.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.hospital_id == hospital_filter
        )
    )
    pending_payments = await session.scalar(
        select(func.coalesce(func.sum(Invoice.balance_due), 0)).where(
            Invoice.hospital_id == hospital_filter,
            Invoice.status.not_in(["VOID", "PAID"]),
        )
    )
    month_expenses = await session.scalar(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.hospital_id == hospital_filter,
            Expense.incurred_at >= month_start,
        )
    )
    month_revenue = sum((p.amount for p in month_payments), Decimal("0"))
    today_revenue = sum((p.amount for p in today_payments), Decimal("0"))
    previous_month_revenue = Decimal(previous_month_revenue or 0)

    def growth(current: int | Decimal, previous: int | Decimal) -> float:
        if not previous:
            return 100.0 if current else 0.0
        return round(float((current - previous) / previous * 100), 1)

    revenue_by_day: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for payment in payments:
        revenue_by_day[payment.received_at.date().isoformat()] += payment.amount
    revenue_points = [
        RevenuePoint(
            date=(seven_days_start + timedelta(days=offset)).date().isoformat(),
            revenue=revenue_by_day[(seven_days_start + timedelta(days=offset)).date().isoformat()],
        )
        for offset in range(7)
    ]

    status_rows = (
        await session.execute(
            select(Appointment.status, func.count(Appointment.id))
            .where(
                Appointment.hospital_id == hospital_filter,
                Appointment.scheduled_start >= month_start,
            )
            .group_by(Appointment.status)
        )
    ).all()
    upcoming = list(
        (
            await session.scalars(
                select(Appointment)
                .options(selectinload(Appointment.patient))
                .where(
                    Appointment.hospital_id == hospital_filter,
                    Appointment.scheduled_start >= today_start,
                    Appointment.status.not_in(["CANCELLED", "COMPLETED"]),
                )
                .order_by(Appointment.scheduled_start)
                .limit(6)
            )
        )
        .unique()
        .all()
    )
    labs = list(
        (
            await session.scalars(
                select(LabOrder)
                .where(
                    LabOrder.hospital_id == hospital_filter,
                    LabOrder.status.not_in(["DELIVERED", "CANCELLED"]),
                )
                .order_by(LabOrder.due_date)
                .limit(4)
            )
        ).all()
    )

    return DashboardResponse(
        overview=Overview(
            total_patients=total_patients,
            new_patients_this_month=new_patients,
            patient_growth=growth(new_patients, previous_new_patients),
            today_appointments=today_appointments,
            this_month_appointments=this_month_appointments,
            appointment_growth=growth(this_month_appointments, previous_month_appointments),
            pending_appointments=pending_today,
            completed_appointments_today=completed_today,
            waiting_patients=waiting_patients,
            this_month_revenue=month_revenue,
            today_revenue=today_revenue,
            revenue_growth=growth(month_revenue, previous_month_revenue),
            pending_payments=Decimal(pending_payments or 0),
            total_revenue=Decimal(total_revenue or 0),
            month_expenses=Decimal(month_expenses or 0),
            net_cash_flow=month_revenue - Decimal(month_expenses or 0),
            active_lab_orders=active_lab_orders,
        ),
        charts=Charts(
            last_7_days_revenue=revenue_points,
            appointments_by_status=[
                StatusPoint(status=row[0], count=row[1]) for row in status_rows
            ],
        ),
        recent_activity=RecentActivity(
            upcoming_appointments=[
                AppointmentItem(
                    id=str(item.id),
                    patient_name=f"{item.patient.first_name} {item.patient.last_name}",
                    patient_number=item.patient.patient_number,
                    doctor_name=item.dentist_name,
                    date=item.scheduled_start,
                    type=item.appointment_type,
                    status=item.status,
                    chair_label=item.chair_label,
                )
                for item in upcoming
            ],
            lab_alerts=[
                LabAlert(
                    id=str(item.id),
                    order_number=item.order_number,
                    appliance_type=item.appliance_type,
                    vendor_name=item.vendor_name,
                    due_date=item.due_date.isoformat() if item.due_date else None,
                    status=item.status,
                )
                for item in labs
            ],
        ),
    )
