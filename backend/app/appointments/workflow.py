from __future__ import annotations

import math
import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.appointments.schemas import AppointmentCreate, AppointmentUpdate, AppointmentView, PersonSummary
from app.common.identifiers import next_document_number
from app.models import Appointment, AppointmentEvent, Patient, Staff


class AppointmentWorkflow:
    """Scheduling invariants: tenancy, collision checks, transitions, and event history."""

    def __init__(self, session: AsyncSession, hospital_id: uuid.UUID, actor_id: uuid.UUID, timezone: str):
        self.session = session
        self.hospital_id = hospital_id
        self.actor_id = actor_id
        self.timezone = ZoneInfo(timezone)

    async def _patient(self, patient_id: uuid.UUID) -> Patient:
        patient = await self.session.scalar(select(Patient).where(Patient.id == patient_id, Patient.hospital_id == self.hospital_id, Patient.is_active.is_(True)))
        if patient is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
        return patient

    async def _dentist(self, dentist_id: uuid.UUID) -> Staff:
        dentist = await self.session.scalar(select(Staff).where(Staff.id == dentist_id, Staff.hospital_id == self.hospital_id, Staff.is_active.is_(True)))
        if dentist is None or dentist.title.upper() != "DENTIST":
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Dentist not found")
        return dentist

    async def _get(self, appointment_id: uuid.UUID) -> Appointment:
        appointment = await self.session.scalar(select(Appointment).where(Appointment.id == appointment_id, Appointment.hospital_id == self.hospital_id))
        if appointment is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")
        return appointment

    def _local_datetime(self, day: date, at: time) -> datetime:
        return datetime.combine(day, at, self.timezone).astimezone(UTC)

    async def _ensure_available(self, dentist_id: uuid.UUID, start: datetime, end: datetime, exclude_id: uuid.UUID | None = None) -> None:
        filters = [
            Appointment.hospital_id == self.hospital_id,
            Appointment.dentist_id == dentist_id,
            Appointment.status.not_in(("CANCELLED", "NO_SHOW")),
            Appointment.scheduled_start < end,
            Appointment.scheduled_end > start,
        ]
        if exclude_id:
            filters.append(Appointment.id != exclude_id)
        conflict = await self.session.scalar(select(Appointment.id).where(*filters).limit(1))
        if conflict:
            raise HTTPException(status.HTTP_409_CONFLICT, "The dentist already has an appointment in this time range")

    async def create(self, payload: AppointmentCreate) -> Appointment:
        patient = await self._patient(payload.patient_id)
        dentist = await self._dentist(payload.doctor_id)
        start = self._local_datetime(payload.scheduled_date, payload.scheduled_time)
        end = start + timedelta(minutes=payload.duration)
        await self._ensure_available(dentist.id, start, end)
        appointment = Appointment(
            hospital_id=self.hospital_id,
            patient_id=patient.id,
            dentist_id=dentist.id,
            appointment_number=await next_document_number(self.session, hospital_id=self.hospital_id, key="appointment", prefix="APT"),
            dentist_name=dentist.name,
            appointment_type=payload.appointment_type,
            priority=payload.priority,
            chief_complaint=payload.chief_complaint,
            is_virtual=payload.is_virtual,
            scheduled_start=start,
            scheduled_end=end,
            duration_minutes=payload.duration,
            status="SCHEDULED",
            chair_label=str(payload.chair_number) if payload.chair_number else None,
            notes=payload.notes,
        )
        self.session.add(appointment)
        await self.session.flush()
        self.session.add(AppointmentEvent(hospital_id=self.hospital_id, appointment_id=appointment.id, event_type="BOOKED", new_start=start, actor_id=self.actor_id))
        return appointment

    async def update(self, appointment_id: uuid.UUID, payload: AppointmentUpdate) -> Appointment:
        appointment = await self._get(appointment_id)
        if appointment.status in {"COMPLETED", "CANCELLED"} and payload.status not in {None, appointment.status}:
            raise HTTPException(status.HTTP_409_CONFLICT, "A completed or cancelled appointment cannot be reopened")
        old_start = appointment.scheduled_start
        dentist_id = payload.doctor_id or appointment.dentist_id
        if dentist_id is None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Appointment has no assigned dentist")
        dentist = await self._dentist(dentist_id)
        local = appointment.scheduled_start.astimezone(self.timezone)
        day = payload.scheduled_date or local.date()
        at = payload.scheduled_time or local.time().replace(tzinfo=None)
        duration = payload.duration or appointment.duration_minutes
        start = self._local_datetime(day, at)
        end = start + timedelta(minutes=duration)
        await self._ensure_available(dentist.id, start, end, appointment.id)
        appointment.dentist_id = dentist.id
        appointment.dentist_name = dentist.name
        appointment.scheduled_start = start
        appointment.scheduled_end = end
        appointment.duration_minutes = duration
        if payload.appointment_type is not None:
            appointment.appointment_type = payload.appointment_type
        if payload.priority is not None:
            appointment.priority = payload.priority
        if payload.chief_complaint is not None:
            appointment.chief_complaint = payload.chief_complaint
        if payload.chair_number is not None:
            appointment.chair_label = str(payload.chair_number)
        if payload.notes is not None:
            appointment.notes = payload.notes
        if payload.status is not None:
            appointment.status = payload.status
        if payload.cancellation_reason is not None:
            appointment.cancellation_reason = payload.cancellation_reason
        appointment.updated_at = datetime.now(UTC)
        event_type = "RESCHEDULED" if start != old_start else (payload.status or "UPDATED")
        self.session.add(AppointmentEvent(hospital_id=self.hospital_id, appointment_id=appointment.id, event_type=event_type, old_start=old_start, new_start=start, reason=payload.cancellation_reason, actor_id=self.actor_id))
        await self.session.flush()
        return appointment

    async def transition(self, appointment_id: uuid.UUID, action: str) -> Appointment:
        appointment = await self._get(appointment_id)
        now = datetime.now(UTC)
        if action == "check-in":
            if appointment.status not in {"SCHEDULED", "CONFIRMED"}:
                raise HTTPException(status.HTTP_409_CONFLICT, "Only scheduled or confirmed appointments can check in")
            appointment.status, appointment.checked_in_at = "CHECKED_IN", now
        elif action == "check-out":
            if appointment.status not in {"CHECKED_IN", "IN_PROGRESS"}:
                raise HTTPException(status.HTTP_409_CONFLICT, "Patient must be checked in before check-out")
            appointment.status, appointment.checked_out_at = "COMPLETED", now
        self.session.add(AppointmentEvent(hospital_id=self.hospital_id, appointment_id=appointment.id, event_type=action.upper(), actor_id=self.actor_id))
        await self.session.flush()
        return appointment

    async def list(self, page: int, limit: int, search: str, status_filter: str | None, type_filter: str | None, day: date | None) -> tuple[list[Appointment], int]:
        filters = [Appointment.hospital_id == self.hospital_id]
        if search:
            pattern = f"%{search.strip()}%"
            filters.append(or_(Appointment.appointment_number.ilike(pattern), Appointment.dentist_name.ilike(pattern), Appointment.patient.has(or_(Patient.first_name.ilike(pattern), Patient.last_name.ilike(pattern), Patient.phone.ilike(pattern)))))
        if status_filter:
            filters.append(Appointment.status == status_filter)
        if type_filter:
            filters.append(Appointment.appointment_type == type_filter)
        if day:
            start = datetime.combine(day, time.min, self.timezone).astimezone(UTC)
            filters.extend((Appointment.scheduled_start >= start, Appointment.scheduled_start < start + timedelta(days=1)))
        total = int(await self.session.scalar(select(func.count(Appointment.id)).where(*filters)) or 0)
        items = list((await self.session.scalars(select(Appointment).where(*filters).order_by(Appointment.scheduled_start).offset((page - 1) * limit).limit(limit))).all())
        return items, total

    async def view(self, appointment: Appointment) -> AppointmentView:
        dentist = await self._dentist(appointment.dentist_id) if appointment.dentist_id else None
        local = appointment.scheduled_start.astimezone(self.timezone)
        patient = appointment.patient
        name_parts = dentist.name.split(maxsplit=1) if dentist else [appointment.dentist_name, ""]
        return AppointmentView(
            id=appointment.id, appointment_no=appointment.appointment_number,
            scheduled_date=local.date(), scheduled_time=local.strftime("%H:%M"),
            scheduled_start=appointment.scheduled_start, scheduled_end=appointment.scheduled_end,
            duration=appointment.duration_minutes, chair_number=int(appointment.chair_label) if appointment.chair_label and appointment.chair_label.isdigit() else None,
            appointment_type=appointment.appointment_type, status=appointment.status, priority=appointment.priority,
            chief_complaint=appointment.chief_complaint, notes=appointment.notes, checked_in_at=appointment.checked_in_at,
            checked_out_at=appointment.checked_out_at,
            wait_time=int((appointment.checked_out_at - appointment.checked_in_at).total_seconds() // 60) if appointment.checked_in_at and appointment.checked_out_at else None,
            cancellation_reason=appointment.cancellation_reason, is_virtual=appointment.is_virtual, created_at=appointment.created_at, updated_at=appointment.updated_at,
            patient=PersonSummary(id=patient.id, patient_id=patient.patient_number, first_name=patient.first_name, last_name=patient.last_name, phone=patient.phone, email=patient.email),
            doctor=PersonSummary(id=dentist.id if dentist else uuid.UUID(int=0), employee_id=dentist.employee_number if dentist else None, first_name=name_parts[0], last_name=name_parts[1] if len(name_parts) > 1 else "", phone=dentist.phone if dentist else None, specialization=dentist.specialization if dentist else None),
        )

    async def slots(self, dentist_id: uuid.UUID, day: date, duration: int) -> list[dict]:
        await self._dentist(dentist_id)
        slots = []
        cursor = datetime.combine(day, time(8, 0), self.timezone).astimezone(UTC)
        end_of_day = datetime.combine(day, time(18, 0), self.timezone).astimezone(UTC)
        existing = list((await self.session.scalars(select(Appointment).where(Appointment.hospital_id == self.hospital_id, Appointment.dentist_id == dentist_id, Appointment.status.not_in(("CANCELLED", "NO_SHOW")), Appointment.scheduled_start < end_of_day, Appointment.scheduled_end > cursor))).all())
        while cursor + timedelta(minutes=duration) <= end_of_day:
            slot_end = cursor + timedelta(minutes=duration)
            available = not any(item.scheduled_start < slot_end and item.scheduled_end > cursor for item in existing)
            slots.append({"time": cursor.astimezone(self.timezone).strftime("%H:%M"), "available": available})
            cursor += timedelta(minutes=30)
        return slots
