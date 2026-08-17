import csv
import io
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Appointment, ClinicalProcedure, Expense, Invoice, Patient, Payment, Staff
from app.security.dependencies import Principal, require_permission
from app.security.permissions import PermissionKey

router = APIRouter(prefix="/api/reports", tags=["reports"])
Session = Annotated[AsyncSession, Depends(get_session)]
CanRead = Annotated[Principal, Depends(require_permission(PermissionKey.REPORTS_READ))]


def period(preset: str, date_from: datetime | None, date_to: datetime | None) -> tuple[datetime, datetime]:
    now = datetime.now(UTC)
    if date_from and date_to:
        return date_from, date_to
    today = datetime.combine(now.date(), time.min, tzinfo=UTC)
    if preset == "today":
        return today, today + timedelta(days=1)
    if preset == "this_week":
        start = today - timedelta(days=today.weekday())
        return start, start + timedelta(days=7)
    if preset == "this_year":
        return today.replace(month=1, day=1), today.replace(year=today.year + 1, month=1, day=1)
    start = today.replace(day=1)
    end = (start + timedelta(days=32)).replace(day=1)
    return start, end


async def scalar(session: AsyncSession, statement) -> int | Decimal:
    return await session.scalar(statement) or 0


async def analytics_data(session: AsyncSession, principal: Principal, report_type: str, start: datetime, end: datetime) -> dict:
    tenant = principal.hospital_id
    if report_type == "patient":
        total = int(await scalar(session, select(func.count(Patient.id)).where(Patient.hospital_id == tenant, Patient.is_active.is_(True))))
        new = int(await scalar(session, select(func.count(Patient.id)).where(Patient.hospital_id == tenant, Patient.created_at >= start, Patient.created_at < end, Patient.is_active.is_(True))))
        demographics = dict((await session.execute(select(Patient.gender, func.count(Patient.id)).where(Patient.hospital_id == tenant, Patient.is_active.is_(True)).group_by(Patient.gender))).all())
        return {"newPatients": new, "returningPatients": max(total - new, 0), "totalPatients": total, "retentionRate": round((max(total - new, 0) / total * 100), 1) if total else 0, "demographics": {"male": demographics.get("MALE", 0), "female": demographics.get("FEMALE", 0), "other": demographics.get("OTHER", 0)}, "ageGroups": [], "acquisitionSources": []}
    if report_type == "clinical":
        total = int(await scalar(session, select(func.count(ClinicalProcedure.id)).where(ClinicalProcedure.hospital_id == tenant, ClinicalProcedure.performed_at >= start, ClinicalProcedure.performed_at < end)))
        completed = int(await scalar(session, select(func.count(ClinicalProcedure.id)).where(ClinicalProcedure.hospital_id == tenant, ClinicalProcedure.performed_at >= start, ClinicalProcedure.performed_at < end, ClinicalProcedure.status == "COMPLETED")))
        common = (await session.execute(select(ClinicalProcedure.procedure_name, func.count(ClinicalProcedure.id)).where(ClinicalProcedure.hospital_id == tenant, ClinicalProcedure.performed_at >= start, ClinicalProcedure.performed_at < end).group_by(ClinicalProcedure.procedure_name).order_by(func.count(ClinicalProcedure.id).desc()).limit(8))).all()
        return {"totalTreatments": total, "completedTreatments": completed, "inProgressTreatments": total - completed, "completionRate": round(completed / total * 100, 1) if total else 0, "avgTreatmentDuration": 0, "commonProcedures": [{"name": name, "code": "", "count": count, "successRate": 100} for name, count in common], "proceduresByCategory": []}
    if report_type == "financial":
        revenue = Decimal(await scalar(session, select(func.sum(Payment.amount)).where(Payment.hospital_id == tenant, Payment.received_at >= start, Payment.received_at < end)))
        expenses = Decimal(await scalar(session, select(func.sum(Expense.amount)).where(Expense.hospital_id == tenant, Expense.incurred_at >= start, Expense.incurred_at < end, Expense.status == "POSTED")))
        outstanding = Decimal(await scalar(session, select(func.sum(Invoice.balance_due)).where(Invoice.hospital_id == tenant, Invoice.status.not_in(("PAID", "VOID")))))
        invoices = int(await scalar(session, select(func.count(Invoice.id)).where(Invoice.hospital_id == tenant, Invoice.issued_at >= start, Invoice.issued_at < end)))
        methods = (await session.execute(select(Payment.method, func.sum(Payment.amount)).where(Payment.hospital_id == tenant, Payment.received_at >= start, Payment.received_at < end).group_by(Payment.method))).all()
        return {"totalRevenue": revenue, "totalExpenses": expenses, "profitMargin": round(float((revenue - expenses) / revenue * 100), 1) if revenue else 0, "avgBillValue": revenue / invoices if invoices else 0, "collectionEfficiency": round(float(revenue / (revenue + outstanding) * 100), 1) if revenue + outstanding else 0, "revenueByMonth": [], "paymentMethodBreakdown": [{"method": method, "amount": amount, "percentage": round(float(amount / revenue * 100), 1) if revenue else 0} for method, amount in methods], "outstandingAmount": outstanding, "currency": principal.currency}
    total = int(await scalar(session, select(func.count(Appointment.id)).where(Appointment.hospital_id == tenant, Appointment.scheduled_start >= start, Appointment.scheduled_start < end)))
    statuses = dict((await session.execute(select(Appointment.status, func.count(Appointment.id)).where(Appointment.hospital_id == tenant, Appointment.scheduled_start >= start, Appointment.scheduled_start < end).group_by(Appointment.status))).all())
    staff_rows = (await session.execute(select(Staff.id, Staff.name, func.count(Appointment.id)).outerjoin(Appointment, (Appointment.dentist_id == Staff.id) & (Appointment.scheduled_start >= start) & (Appointment.scheduled_start < end)).where(Staff.hospital_id == tenant, Staff.title == "DENTIST").group_by(Staff.id, Staff.name))).all()
    no_shows = statuses.get("NO_SHOW", 0)
    return {"totalAppointments": total, "completedAppointments": statuses.get("COMPLETED", 0), "cancelledAppointments": statuses.get("CANCELLED", 0), "noShowCount": no_shows, "noShowRate": round(no_shows / total * 100, 1) if total else 0, "appointmentUtilization": round((statuses.get("COMPLETED", 0) / total * 100), 1) if total else 0, "avgWaitTime": 0, "staffProductivity": [{"staffId": str(staff_id), "name": name, "role": "DENTIST", "appointmentsHandled": count, "treatmentsCompleted": 0, "revenue": 0} for staff_id, name, count in staff_rows], "inventoryTurnover": 0, "lowStockItems": 0}


@router.get("/analytics")
async def analytics(principal: CanRead, session: Session, type_: Annotated[Literal["patient", "clinical", "financial", "operational"], Query(alias="type")] = "patient", preset: str = "this_month", date_from: Annotated[datetime | None, Query(alias="dateFrom")] = None, date_to: Annotated[datetime | None, Query(alias="dateTo")] = None) -> dict:
    start, end = period(preset, date_from, date_to)
    return await analytics_data(session, principal, type_, start, end)


@router.get("/export")
async def export_report(principal: CanRead, session: Session, type_: Annotated[Literal["patient", "clinical", "financial", "operational"], Query(alias="type")] = "patient", preset: str = "this_month") -> StreamingResponse:
    start, end = period(preset, None, None)
    data = await analytics_data(session, principal, type_, start, end)
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["Dental ERP report", type_, start.date().isoformat(), end.date().isoformat(), principal.currency])
    writer.writerow(["Metric", "Value"])
    for key, value in data.items():
        if not isinstance(value, (list, dict)):
            writer.writerow([key, value])
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv; charset=utf-8")
    response.headers["Content-Disposition"] = f'attachment; filename="{type_}-report.csv"'
    return response
