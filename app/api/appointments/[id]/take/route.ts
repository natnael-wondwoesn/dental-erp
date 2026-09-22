import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'

/**
 * Atomically assign a waiting patient to the authenticated doctor.
 *
 * updateMany acts as a compare-and-set: only a CHECKED_IN appointment without
 * an assignment timestamp can be changed. Concurrent requests therefore have
 * one winner; every later request observes count=0 and receives 409.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId, session } = await requireAuthAndRole(['DOCTOR'])

  if (error || !hospitalId || !session) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const staffId = session.user.staffId
  if (!staffId) {
    return NextResponse.json(
      { error: 'Your user account is not linked to a doctor staff record' },
      { status: 403 }
    )
  }

  const { id } = await params
  const doctor = await prisma.staff.findFirst({
    where: {
      id: staffId,
      hospitalId,
      userId: session.user.id,
      user: { role: 'DOCTOR', isActive: true },
    },
    select: { id: true },
  })

  if (!doctor) {
    return NextResponse.json({ error: 'Doctor staff record not found' }, { status: 403 })
  }

  const assignedAt = new Date()
  const claimed = await prisma.appointment.updateMany({
    where: {
      id,
      hospitalId,
      status: 'CHECKED_IN',
      assignedAt: null,
    },
    data: {
      doctorId: doctor.id,
      assignedAt,
      status: 'IN_PROGRESS',
    },
  })

  if (claimed.count !== 1) {
    const appointment = await prisma.appointment.findFirst({
      where: { id, hospitalId },
      select: { status: true, assignedAt: true },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    return NextResponse.json(
      {
        error:
          appointment.assignedAt || appointment.status === 'IN_PROGRESS'
            ? 'This patient has already been taken by another doctor'
            : `Cannot take a patient with appointment status: ${appointment.status}`,
      },
      { status: 409 }
    )
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id, hospitalId },
    include: {
      patient: {
        select: {
          id: true,
          patientId: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      doctor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          specialization: true,
        },
      },
    },
  })

  return NextResponse.json(appointment)
}
