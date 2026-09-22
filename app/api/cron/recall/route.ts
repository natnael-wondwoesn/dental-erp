import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { smsService } from '@/lib/services/sms.service'

/**
 * GET /api/cron/recall
 * Scheduled daily during the clinic's permitted SMS window.
 * Identifies patients who need to be recalled:
 *   1. No visit in 6+ months
 *   2. Incomplete treatment plans
 *   3. Overdue follow-ups
 * Creates AIInsight records and notifications for ADMIN.
 */
export async function GET(req: Request) {
  const secret = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const staleProcessingCutoff = new Date(now.getTime() - 15 * 60 * 1000)

  // Make crashed/abandoned claims retryable, while concurrent cron invocations
  // are still protected by the SENDING compare-and-set below.
  await prisma.patientRecall.updateMany({
    where: {
      smsStatus: 'SENDING',
      processingAt: { lt: staleProcessingCutoff },
      status: 'SCHEDULED',
    },
    data: { smsStatus: 'FAILED', processingAt: null, lastSmsError: 'Previous send timed out' },
  })

  const dueRecalls =
    (await prisma.patientRecall.findMany({
      where: {
        status: 'SCHEDULED',
        reminderDate: { lte: now },
        followUpDate: { gte: now },
        smsAttempts: { lt: 3 },
        smsStatus: { in: ['PENDING', 'FAILED'] },
      },
      include: {
        patient: { select: { firstName: true, lastName: true, phone: true } },
        hospital: { select: { name: true, phone: true, timezone: true } },
      },
      orderBy: { reminderDate: 'asc' },
      take: 200,
    })) ?? []

  const recallReminders = { due: dueRecalls.length, sent: 0, failed: 0, skipped: 0 }
  for (const recall of dueRecalls) {
    const claimed = await prisma.patientRecall.updateMany({
      where: {
        id: recall.id,
        status: 'SCHEDULED',
        smsStatus: recall.smsStatus,
        smsAttempts: recall.smsAttempts,
      },
      data: {
        smsStatus: 'SENDING',
        processingAt: now,
        smsAttempts: { increment: 1 },
        lastSmsError: null,
      },
    })
    if (claimed.count !== 1) {
      recallReminders.skipped++
      continue
    }

    const patientName = `${recall.patient.firstName} ${recall.patient.lastName}`.trim()
    const checkupDate = new Intl.DateTimeFormat('en-ET', {
      timeZone: recall.hospital.timezone || 'Africa/Addis_Ababa',
      dateStyle: 'medium',
    }).format(recall.followUpDate)
    const contact = recall.hospital.phone ? ` Contact us at ${recall.hospital.phone}.` : ''
    const message = `Hello ${patientName}, your dental check-up is coming up on ${checkupDate}. Please visit ${recall.hospital.name} for your check-up.${contact}`

    try {
      const smsLogId = await smsService.sendSMS({
        hospitalId: recall.hospitalId,
        patientId: recall.patientId,
        phone: recall.patient.phone,
        message,
        timezone: recall.hospital.timezone || 'Africa/Addis_Ababa',
      })
      await prisma.patientRecall.update({
        where: { id: recall.id },
        data: {
          status: 'REMINDER_SENT',
          smsStatus: 'SENT',
          smsLogId,
          smsSentAt: new Date(),
          processingAt: null,
        },
      })
      recallReminders.sent++
    } catch (error) {
      await prisma.patientRecall.update({
        where: { id: recall.id },
        data: {
          smsStatus: 'FAILED',
          processingAt: null,
          lastSmsError: error instanceof Error ? error.message : 'Unknown SMS error',
        },
      })
      recallReminders.failed++
    }
  }

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(now.getMonth() - 6)

  const hospitals = await prisma.hospital.findMany({
    where: { isActive: true, onboardingCompleted: true },
    select: { id: true },
  })

  const results: {
    hospitalId: string
    noVisit: number
    incomplete: number
    overdueFollowUp: number
  }[] = []

  for (const hospital of hospitals) {
    // 1. Patients with no appointment in 6+ months
    const activePatients = await prisma.patient.findMany({
      where: { hospitalId: hospital.id, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    })

    const patientsWithRecentVisit = new Set(
      (
        await prisma.appointment.findMany({
          where: {
            hospitalId: hospital.id,
            scheduledDate: { gte: sixMonthsAgo },
            status: 'COMPLETED',
          },
          select: { patientId: true },
        })
      ).map((a) => a.patientId)
    )

    const noVisitPatients = activePatients.filter((p) => !patientsWithRecentVisit.has(p.id))

    // 2. Incomplete treatment plans (DRAFT, PROPOSED, IN_PROGRESS older than 60 days)
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(now.getDate() - 60)
    const incompleteTP = await prisma.treatmentPlan.findMany({
      where: {
        hospitalId: hospital.id,
        status: { in: ['DRAFT', 'PROPOSED', 'IN_PROGRESS'] },
        createdAt: { lt: sixtyDaysAgo },
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
    })

    // 3. Overdue follow-ups
    const overdueFollowUps = await prisma.treatment.findMany({
      where: {
        hospitalId: hospital.id,
        followUpRequired: true,
        followUpDate: { lt: now },
        status: 'COMPLETED',
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
    })

    // Create recall insight
    if (noVisitPatients.length > 0 || incompleteTP.length > 0 || overdueFollowUps.length > 0) {
      const description = [
        noVisitPatients.length > 0 &&
          `${noVisitPatients.length} patient(s) not visited in 6+ months`,
        incompleteTP.length > 0 && `${incompleteTP.length} incomplete treatment plan(s)`,
        overdueFollowUps.length > 0 && `${overdueFollowUps.length} overdue follow-up(s)`,
      ]
        .filter(Boolean)
        .join('; ')

      await prisma.aIInsight.create({
        data: {
          hospitalId: hospital.id,
          category: 'PATIENT',
          severity: noVisitPatients.length > 10 ? 'WARNING' : 'INFO',
          title: 'Patient Recall Required',
          description,
          data: {
            noVisitPatients: noVisitPatients
              .slice(0, 10)
              .map((p) => `${p.firstName} ${p.lastName}`),
            incompleteTP: incompleteTP
              .slice(0, 5)
              .map((tp) => `${tp.patient.firstName} ${tp.patient.lastName} – ${tp.title}`),
            overdueFollowUps: overdueFollowUps
              .slice(0, 5)
              .map((t) => `${t.patient.firstName} ${t.patient.lastName}`),
          } as any,
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      // Notify ADMIN
      const admin = await prisma.user.findFirst({
        where: { hospitalId: hospital.id, role: 'ADMIN', isActive: true },
        select: { id: true },
      })
      if (admin) {
        await prisma.notification.create({
          data: {
            hospitalId: hospital.id,
            userId: admin.id,
            title: 'Weekly Patient Recall',
            message: description,
            type: 'PATIENT' as any,
            entityType: 'AIInsight',
            entityId: 'recall',
          },
        })
      }
    }

    results.push({
      hospitalId: hospital.id,
      noVisit: noVisitPatients.length,
      incomplete: incompleteTP.length,
      overdueFollowUp: overdueFollowUps.length,
    })
  }

  return NextResponse.json({ results, recallReminders, processedAt: now.toISOString() })
}
