import { eligibleTenantIds } from '@/lib/saas/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { classifyLabDeadline, labReminderRange } from '@/lib/lab-deadlines'
import { communicationTriggersService } from '@/lib/services/communication-triggers.service'

/**
 * GET /api/cron/reminders
 * Scheduled: every hour
 * Finds appointments in the next 24 hours that have no reminder sent,
 * creates AppointmentReminder records.
 * Actual SMS/Email/WhatsApp dispatch would be handled by your communication service.
 */
export async function GET(req: Request) {
  const secret = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const eligible = await eligibleTenantIds(['appointments', 'communications'])
  const eligibleLab = await eligibleTenantIds(['lab'])

  const now = new Date()
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // Find appointments in next 24 hours across all active hospitals
  const appointments = await prisma.appointment.findMany({
    where: {
      ...(eligible ? { hospitalId: { in: eligible } } : {}),
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      scheduledDate: { gte: now, lte: in24Hours },
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      reminders: true,
    },
  })

  // Gather no-show history for risk assessment
  const patientIds = [...new Set(appointments.map((a) => a.patientId))]
  const noShowCounts = await prisma.appointment.groupBy({
    by: ['patientId'],
    where: {
      patientId: { in: patientIds },
      status: 'NO_SHOW',
    },
    _count: true,
  })
  const totalCounts = await prisma.appointment.groupBy({
    by: ['patientId'],
    where: {
      patientId: { in: patientIds },
      scheduledDate: { lt: now },
    },
    _count: true,
  })
  const noShowMap: Record<string, number> = {}
  const totalMap: Record<string, number> = {}
  for (const ns of noShowCounts) noShowMap[ns.patientId] = ns._count
  for (const t of totalCounts) totalMap[t.patientId] = t._count

  let created = 0
  let extraReminders = 0
  for (const appt of appointments) {
    // Skip if already has a pending/sent reminder
    const hasPending = appt.reminders.some((r) => r.status === 'PENDING' || r.status === 'SENT')
    if (hasPending) continue

    // Determine channel — default to SMS
    const channel = 'SMS'

    // Assess no-show risk: high if >30% no-show rate with at least 2 past appointments
    const total = totalMap[appt.patientId] || 0
    const noShows = noShowMap[appt.patientId] || 0
    const isHighRisk = total >= 2 && noShows / total > 0.3

    await prisma.appointmentReminder.create({
      data: {
        appointmentId: appt.id,
        reminderType: channel as any,
        scheduledFor: new Date(appt.scheduledDate.getTime() - 60 * 60 * 1000), // 1 hour before
        status: 'PENDING',
      },
    })
    created++

    // High-risk patients get an extra early reminder (3 hours before)
    if (isHighRisk) {
      await prisma.appointmentReminder.create({
        data: {
          appointmentId: appt.id,
          reminderType: channel as any,
          scheduledFor: new Date(appt.scheduledDate.getTime() - 3 * 60 * 60 * 1000),
          status: 'PENDING',
        },
      })
      extraReminders++
    }
  }

  const labRange = labReminderRange(now)
  const labOrders =
    (await prisma.labOrder.findMany({
      where: {
        ...(eligibleLab ? { hospitalId: { in: eligibleLab } } : {}),
        expectedDate: { lte: labRange.end },
        status: { notIn: ['FITTED', 'CANCELLED'] },
        deletedAt: null,
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        labVendor: { select: { name: true } },
      },
    })) || []

  let labDueSoon = 0
  let labOverdue = 0
  let labNotifications = 0
  for (const order of labOrders) {
    const deadlineState = classifyLabDeadline(order.expectedDate, order.status, now)
    if (!['DUE_SOON', 'OVERDUE'].includes(deadlineState)) continue
    if (deadlineState === 'DUE_SOON') labDueSoon++
    else labOverdue++

    const entityType = deadlineState === 'OVERDUE' ? 'LabOrder:Overdue' : 'LabOrder:DueSoon'
    const existing = await prisma.notification.findFirst({
      where: { hospitalId: order.hospitalId, entityType, entityId: order.id },
      select: { id: true },
    })
    if (existing) continue

    const users =
      (await prisma.user.findMany({
        where: {
          hospitalId: order.hospitalId,
          role: { in: ['ADMIN', 'RECEPTIONIST'] },
          isActive: true,
        },
        select: { id: true },
      })) || []
    const patientName = `${order.patient.firstName} ${order.patient.lastName}`.trim()
    const expected = order.expectedDate
      ? new Date(order.expectedDate).toLocaleDateString('en-ET')
      : 'not set'
    for (const user of users) {
      await prisma.notification.create({
        data: {
          hospitalId: order.hospitalId,
          userId: user.id,
          title: deadlineState === 'OVERDUE' ? 'Lab order overdue' : 'Lab order due soon',
          message: `${order.orderNumber} for ${patientName} at ${order.labVendor.name} is ${deadlineState === 'OVERDUE' ? 'overdue' : 'due soon'} (expected ${expected}).`,
          type: deadlineState === 'OVERDUE' ? 'ERROR' : 'WARNING',
          entityType,
          entityId: order.id,
        },
      })
      labNotifications++
    }
  }

  const paymentReminders = await communicationTriggersService.sendPaymentReminders()

  return NextResponse.json({
    checked: appointments.length,
    created,
    extraReminders,
    lab: {
      checked: labOrders.length,
      dueSoon: labDueSoon,
      overdue: labOverdue,
      notificationsCreated: labNotifications,
    },
    paymentReminders,
    processedAt: now.toISOString(),
  })
}
