import { NextResponse } from 'next/server'

import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

function startOfDay(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(value: Date, days: number) {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date
}

export async function GET() {
  const { error, hospitalId, session } = await requireAuthAndRole(['DOCTOR'])
  const staffId = session?.user?.staffId

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!staffId) {
    return NextResponse.json(
      { error: 'Doctor profile is not linked to this account' },
      { status: 409 }
    )
  }

  const today = startOfDay(new Date())
  const tomorrow = addDays(today, 1)
  const followUpCutoff = addDays(today, 7)

  const [hospital, appointments, activeTreatments, followUps] = await Promise.all([
    prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { currency: true, timezone: true },
    }),
    prisma.appointment.findMany({
      where: {
        hospitalId,
        doctorId: staffId,
        scheduledDate: { gte: today, lt: tomorrow },
      },
      include: {
        patient: {
          select: { id: true, patientId: true, firstName: true, lastName: true, phone: true },
        },
      },
      orderBy: [{ scheduledTime: 'asc' }],
    }),
    prisma.treatment.findMany({
      where: {
        hospitalId,
        doctorId: staffId,
        status: { in: ['PLANNED', 'IN_PROGRESS'] },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        procedure: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    }),
    prisma.treatment.findMany({
      where: {
        hospitalId,
        doctorId: staffId,
        followUpRequired: true,
        followUpDate: { gte: today, lte: followUpCutoff },
        status: { not: 'CANCELLED' },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        procedure: { select: { name: true } },
      },
      orderBy: { followUpDate: 'asc' },
      take: 8,
    }),
  ])

  return NextResponse.json({
    stats: {
      appointmentsToday: appointments.length,
      waitingPatients: appointments.filter((item) => item.status === 'CHECKED_IN').length,
      completedToday: appointments.filter((item) => item.status === 'COMPLETED').length,
      activeTreatments: activeTreatments.length,
    },
    appointments,
    activeTreatments,
    followUps,
    currency: hospital?.currency || 'ETB',
    timezone: hospital?.timezone || 'Africa/Addis_Ababa',
  })
}
