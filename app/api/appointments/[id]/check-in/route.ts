import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'

// POST - Check in patient for appointment
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const appointment = await prisma.appointment.findFirst({
      where: { id, hospitalId },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Idempotent: a second check-in of the same appointment returns the existing visit
    if (appointment.status === 'CHECKED_IN') {
      const existing = await prisma.appointment.findFirst({
        where: { id, hospitalId },
        include: {
          patient: {
            select: { id: true, patientId: true, firstName: true, lastName: true, phone: true },
          },
          doctor: { select: { id: true, firstName: true, lastName: true } },
        },
      })
      return NextResponse.json(existing)
    }

    // Validate appointment status for check-in
    if (!['SCHEDULED', 'CONFIRMED'].includes(appointment.status)) {
      return NextResponse.json(
        { error: `Cannot check in appointment with status: ${appointment.status}` },
        { status: 400 }
      )
    }

    const checkedInAt = new Date()

    // Calculate wait time from scheduled time
    const scheduledDateTime = new Date(appointment.scheduledDate)
    const [hours, minutes] = appointment.scheduledTime.split(':').map(Number)
    scheduledDateTime.setHours(hours, minutes, 0, 0)

    const waitTime =
      checkedInAt > scheduledDateTime
        ? Math.round((checkedInAt.getTime() - scheduledDateTime.getTime()) / 60000)
        : 0

    // Compare-and-set so two concurrent check-ins cannot both succeed
    const claimed = await prisma.appointment.updateMany({
      where: { id, hospitalId, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
      data: {
        status: 'CHECKED_IN',
        checkedInAt,
        waitTime,
        assignedAt: null,
      },
    })

    const updatedAppointment = await prisma.appointment.findFirst({
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
          },
        },
      },
    })

    if (claimed.count !== 1 && updatedAppointment?.status !== 'CHECKED_IN') {
      return NextResponse.json(
        { error: `Cannot check in appointment with status: ${updatedAppointment?.status}` },
        { status: 409 }
      )
    }

    // count 0 with CHECKED_IN means a concurrent request already checked in: return it, no duplicate
    return NextResponse.json(updatedAppointment)
  } catch (error) {
    console.error('Error checking in appointment:', error)
    return NextResponse.json({ error: 'Failed to check in' }, { status: 500 })
  }
}
