import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { clinicClockTime, decideWalkIn } from '@/lib/patient-management'

const include = {
  patient: {
    select: { id: true, patientId: true, firstName: true, lastName: true, phone: true },
  },
  doctor: { select: { id: true, firstName: true, lastName: true } },
}

// POST - Create a walk-in visit: an appointment for today, linked to an existing patient,
// immediately CHECKED_IN. Never creates a second active visit for the same patient today.
export async function POST(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { patientId, doctorId, appointmentType = 'CONSULTATION', chiefComplaint, notes } = body

    if (!patientId || !doctorId) {
      return NextResponse.json({ error: 'Patient and doctor are required' }, { status: 400 })
    }

    const [patient, doctor] = await Promise.all([
      prisma.patient.findFirst({ where: { id: patientId, hospitalId }, select: { id: true } }),
      prisma.staff.findFirst({ where: { id: doctorId, hospitalId }, select: { id: true } }),
    ])
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    if (!doctor) return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })

    const now = new Date()
    const dayStart = new Date(now)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const todays = await prisma.appointment.findMany({
      where: {
        hospitalId,
        patientId,
        scheduledDate: { gte: dayStart, lt: dayEnd },
        status: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
      },
      select: { id: true, status: true },
    })

    const decision = decideWalkIn(todays)

    if (decision.action === 'existing-active') {
      const existing = await prisma.appointment.findFirst({
        where: { id: decision.appointmentId, hospitalId },
        include,
      })
      return NextResponse.json(
        {
          error: 'This patient already has an active visit today.',
          code: 'ACTIVE_VISIT_EXISTS',
          appointment: existing,
        },
        { status: 409 }
      )
    }

    if (decision.action === 'check-in-scheduled') {
      // Conditional update: only one concurrent request can flip the status.
      await prisma.appointment.updateMany({
        where: {
          id: decision.appointmentId,
          hospitalId,
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        },
        data: { status: 'CHECKED_IN', checkedInAt: now, waitTime: 0, assignedAt: null },
      })
      const appointment = await prisma.appointment.findFirst({
        where: { id: decision.appointmentId, hospitalId },
        include,
      })
      return NextResponse.json(appointment, { status: 200 })
    }

    const prefix = `APT${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const last = await prisma.appointment.findFirst({
      where: { hospitalId, appointmentNo: { startsWith: prefix } },
      orderBy: { appointmentNo: 'desc' },
    })
    const next = last ? parseInt(last.appointmentNo.slice(-4)) + 1 : 1
    const appointmentNo = `${prefix}${String(next).padStart(4, '0')}`
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { timezone: true },
    })
    const scheduledTime = clinicClockTime(now, hospital?.timezone)

    const appointment = await prisma.appointment.create({
      data: {
        appointmentNo,
        patientId,
        doctorId,
        hospitalId,
        scheduledDate: dayStart,
        scheduledTime,
        appointmentType,
        chiefComplaint,
        notes,
        status: 'CHECKED_IN',
        checkedInAt: now,
        waitTime: 0,
      },
      include,
    })

    return NextResponse.json(appointment, { status: 201 })
  } catch (err) {
    console.error('Error creating walk-in visit:', err)
    return NextResponse.json({ error: 'Failed to create visit' }, { status: 500 })
  }
}
