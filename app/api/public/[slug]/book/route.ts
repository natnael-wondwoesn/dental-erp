import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  bookingDateTime,
  ethiopianPhoneAliases,
  makePublicRecordNumber,
  minutesSinceMidnight,
  normalizeEthiopianPhone,
  overlaps,
  parseBookingDate,
} from '@/lib/public-booking'

const bookingSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(9).max(24),
  email: z.email().optional().or(z.literal('')),
  doctorId: z.string().trim().min(1),
  date: z.string(),
  time: z.string(),
  type: z.enum(['CONSULTATION', 'PROCEDURE', 'FOLLOW_UP', 'EMERGENCY', 'CHECK_UP']).optional(),
  chiefComplaint: z.string().trim().max(1000).optional(),
  website: z.string().max(0).optional(),
})

/**
 * POST: Public booking endpoint.
 * Books an existing patient by phone or creates a minimal patient record for a
 * first-time visitor. The hidden website field is a simple bot trap.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const parsedBody = bookingSchema.safeParse(await req.json())
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Please check the booking details and try again' },
        { status: 400 }
      )
    }
    const { firstName, lastName, phone, email, doctorId, date, time, type, chiefComplaint } =
      parsedBody.data
    const normalizedPhone = normalizeEthiopianPhone(phone)
    const dateObj = parseBookingDate(date)
    const requestedAt = bookingDateTime(date, time)
    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Enter a valid Ethiopian mobile number' }, { status: 400 })
    }
    if (!dateObj || !requestedAt || requestedAt <= new Date()) {
      return NextResponse.json({ error: 'Choose a future appointment time' }, { status: 400 })
    }

    const hospital = await prisma.hospital.findUnique({
      where: { slug },
      select: { id: true, workingHours: true, patientPortalEnabled: true },
    })

    if (!hospital) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    if (!hospital.patientPortalEnabled) {
      return NextResponse.json({ error: 'Online booking is not enabled' }, { status: 403 })
    }

    // Verify doctor
    const doctor = await prisma.staff.findFirst({
      where: { id: doctorId, hospitalId: hospital.id, isActive: true, user: { role: 'DOCTOR' } },
      select: { id: true, firstName: true, lastName: true },
    })

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    const holiday = await prisma.holiday.findFirst({
      where: { hospitalId: hospital.id, date: dateObj },
    })
    if (holiday) {
      return NextResponse.json(
        { error: 'The clinic is closed on the selected date' },
        { status: 409 }
      )
    }

    const dayOfWeek = dateObj.getUTCDay()
    const shift = await prisma.staffShift.findUnique({
      where: { staffId_dayOfWeek: { staffId: doctorId, dayOfWeek } },
    })
    let hours = { start: '09:00', end: '21:00', lunchStart: '13:00', lunchEnd: '14:00' }
    try {
      if (hospital.workingHours) hours = { ...hours, ...JSON.parse(hospital.workingHours) }
    } catch {
      // Keep safe defaults when an old installation contains malformed hours.
    }
    const slotStart = time
    const activeShift = shift?.isActive === false ? null : shift
    const start = activeShift?.startTime || hours.start
    const end = activeShift?.endTime || hours.end
    if (
      slotStart < start ||
      slotStart >= end ||
      overlaps(
        slotStart,
        30,
        hours.lunchStart,
        Math.max(0, minutesSinceMidnight(hours.lunchEnd) - minutesSinceMidnight(hours.lunchStart))
      )
    ) {
      return NextResponse.json(
        { error: 'That time is outside the doctor’s available hours' },
        { status: 409 }
      )
    }

    const conflicts = await prisma.appointment.findMany({
      where: {
        hospitalId: hospital.id,
        doctorId,
        scheduledDate: dateObj,
        status: { notIn: ['CANCELLED', 'NO_SHOW', 'RESCHEDULED'] },
      },
      select: { patientId: true, scheduledTime: true, duration: true },
    })
    if (
      conflicts.some((appointment) =>
        overlaps(time, 30, appointment.scheduledTime, appointment.duration)
      )
    ) {
      return NextResponse.json(
        { error: 'That time was just booked. Please choose another available time.' },
        { status: 409 }
      )
    }

    let patient = await prisma.patient.findFirst({
      where: {
        hospitalId: hospital.id,
        phone: { in: ethiopianPhoneAliases(normalizedPhone) },
        isActive: true,
      },
      select: { id: true, firstName: true, lastName: true },
    })
    let patientCreated = false
    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          hospitalId: hospital.id,
          patientId: makePublicRecordNumber('PAT'),
          firstName,
          lastName,
          phone: normalizedPhone,
          email: email || null,
        },
        select: { id: true, firstName: true, lastName: true },
      })
      patientCreated = true
    }

    const appointment = await prisma.appointment.create({
      data: {
        hospitalId: hospital.id,
        appointmentNo: makePublicRecordNumber('APT'),
        patientId: patient.id,
        doctorId,
        scheduledDate: dateObj,
        scheduledTime: time,
        appointmentType: type || 'CONSULTATION',
        status: 'SCHEDULED',
        chiefComplaint: chiefComplaint || null,
      },
    })

    return NextResponse.json(
      {
        success: true,
        patientCreated,
        appointment: {
          appointmentNo: appointment.appointmentNo,
          date: appointment.scheduledDate,
          time: appointment.scheduledTime,
          doctor: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        },
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    console.error('Public booking error:', err)
    return NextResponse.json({ error: 'Failed to book appointment' }, { status: 500 })
  }
}
