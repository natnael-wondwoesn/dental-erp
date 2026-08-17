import { NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

type MetricKind = 'number' | 'currency' | 'percentage'

function startOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addDays(date: Date, days: number) {
  const value = new Date(date)
  value.setDate(value.getDate() + days)
  return value
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function toNumber(value: { toString(): string } | number | null | undefined) {
  if (value == null) return 0
  return typeof value === 'number' ? value : Number(value.toString())
}

function percent(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

function ratio(part: number, total: number) {
  if (total === 0) return 0
  return Math.round((part / total) * 100)
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function metric(label: string, value: number, kind: MetricKind = 'number') {
  return { label, value, kind }
}

export async function GET() {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const todayStart = startOfDay(now)
    const tomorrow = addDays(todayStart, 1)
    const next7Days = addDays(todayStart, 7)
    const thirtyDaysAgo = addDays(todayStart, -30)
    const currentMonthStart = startOfMonth(now)
    const nextMonthStart = addMonths(currentMonthStart, 1)
    const previousMonthStart = addMonths(currentMonthStart, -1)

    const [
      hospital,
      totalPatients,
      newPatientsThisMonth,
      outstandingPatientGroups,
      patientActivePlans,
      appointmentsToday,
      checkedInToday,
      completedToday,
      noShow30,
      totalAppointments30,
      inProgressTreatments,
      followUpsDue,
      completedTreatmentsThisMonth,
      activeTreatmentPlans,
      collectedThisMonthAgg,
      outstandingAgg,
      pendingInvoiceCount,
      openInsuranceClaims,
      activePaymentPlans,
      activeLabOrders,
      labReadyCount,
      labDueSoonCount,
      labRemakeCount,
      labVendorCount,
      currentMonthRevenueAgg,
      previousMonthRevenueAgg,
      monthExpensesAgg,
      avgInvoiceAgg,
      lowStockItems,
    ] = await Promise.all([
      prisma.hospital.findUnique({
        where: { id: hospitalId },
        select: {
          currency: true,
          timezone: true,
        },
      }),
      prisma.patient.count({
        where: { hospitalId, isActive: true },
      }),
      prisma.patient.count({
        where: {
          hospitalId,
          isActive: true,
          createdAt: { gte: currentMonthStart, lt: nextMonthStart },
        },
      }),
      prisma.invoice.groupBy({
        by: ['patientId'],
        where: {
          hospitalId,
          balanceAmount: { gt: 0 },
        },
      }),
      prisma.treatmentPlan.count({
        where: {
          hospitalId,
          status: { in: ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS'] },
        },
      }),
      prisma.appointment.count({
        where: {
          hospitalId,
          scheduledDate: { gte: todayStart, lt: tomorrow },
        },
      }),
      prisma.appointment.count({
        where: {
          hospitalId,
          scheduledDate: { gte: todayStart, lt: tomorrow },
          status: 'CHECKED_IN',
        },
      }),
      prisma.appointment.count({
        where: {
          hospitalId,
          scheduledDate: { gte: todayStart, lt: tomorrow },
          status: 'COMPLETED',
        },
      }),
      prisma.appointment.count({
        where: {
          hospitalId,
          scheduledDate: { gte: thirtyDaysAgo, lt: tomorrow },
          status: 'NO_SHOW',
        },
      }),
      prisma.appointment.count({
        where: {
          hospitalId,
          scheduledDate: { gte: thirtyDaysAgo, lt: tomorrow },
        },
      }),
      prisma.treatment.count({
        where: {
          hospitalId,
          status: 'IN_PROGRESS',
        },
      }),
      prisma.treatment.count({
        where: {
          hospitalId,
          followUpRequired: true,
          followUpDate: { gte: todayStart, lt: next7Days },
          status: { not: 'CANCELLED' },
        },
      }),
      prisma.treatment.count({
        where: {
          hospitalId,
          status: 'COMPLETED',
          endTime: { gte: currentMonthStart, lt: nextMonthStart },
        },
      }),
      prisma.treatmentPlan.count({
        where: {
          hospitalId,
          status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
        },
      }),
      prisma.payment.aggregate({
        where: {
          hospitalId,
          status: 'COMPLETED',
          paymentDate: { gte: currentMonthStart, lt: nextMonthStart },
        },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          hospitalId,
          balanceAmount: { gt: 0 },
        },
        _sum: { balanceAmount: true },
      }),
      prisma.invoice.count({
        where: {
          hospitalId,
          status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
      }),
      prisma.insuranceClaim.count({
        where: {
          hospitalId,
          status: {
            in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED'],
          },
        },
      }),
      prisma.paymentPlan.count({
        where: {
          hospitalId,
          status: 'ACTIVE',
        },
      }),
      prisma.labOrder.count({
        where: {
          hospitalId,
          deletedAt: null,
          status: { in: ['CREATED', 'SENT_TO_LAB', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY'] },
        },
      }),
      prisma.labOrder.count({
        where: {
          hospitalId,
          deletedAt: null,
          status: 'READY',
        },
      }),
      prisma.labOrder.count({
        where: {
          hospitalId,
          deletedAt: null,
          expectedDate: { gte: todayStart, lt: next7Days },
          status: { in: ['CREATED', 'SENT_TO_LAB', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY'] },
        },
      }),
      prisma.labOrder.count({
        where: {
          hospitalId,
          deletedAt: null,
          status: 'REMAKE_REQUIRED',
        },
      }),
      prisma.labVendor.count({
        where: {
          hospitalId,
          deletedAt: null,
          status: 'ACTIVE',
        },
      }),
      prisma.payment.aggregate({
        where: {
          hospitalId,
          status: 'COMPLETED',
          paymentDate: { gte: currentMonthStart, lt: nextMonthStart },
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          hospitalId,
          status: 'COMPLETED',
          paymentDate: { gte: previousMonthStart, lt: currentMonthStart },
        },
        _sum: { amount: true },
      }),
      prisma.stockTransaction.aggregate({
        where: {
          hospitalId,
          type: 'PURCHASE',
          transactionDate: { gte: currentMonthStart, lt: nextMonthStart },
        },
        _sum: { totalPrice: true },
      }),
      prisma.invoice.aggregate({
        where: {
          hospitalId,
          createdAt: { gte: currentMonthStart, lt: nextMonthStart },
        },
        _avg: { totalAmount: true },
      }),
      prisma.stockAlert.count({
        where: {
          hospitalId,
          isAcknowledged: false,
          alertType: { in: ['LOW_STOCK', 'OUT_OF_STOCK'] },
        },
      }),
    ])

    const currency = hospital?.currency || 'ETB'
    const timezone = hospital?.timezone || 'Africa/Addis_Ababa'
    const collectedThisMonth = toNumber(collectedThisMonthAgg._sum.amount)
    const outstandingBalance = toNumber(outstandingAgg._sum.balanceAmount)
    const monthExpenses = toNumber(monthExpensesAgg._sum.totalPrice)
    const currentMonthRevenue = toNumber(currentMonthRevenueAgg._sum.amount)
    const previousMonthRevenue = toNumber(previousMonthRevenueAgg._sum.amount)
    const avgInvoiceValue = toNumber(avgInvoiceAgg._avg.totalAmount)
    const noShowRate = ratio(noShow30, totalAppointments30)
    const revenueGrowth = percent(currentMonthRevenue, previousMonthRevenue)
    const netCashFlow = currentMonthRevenue - monthExpenses

    return NextResponse.json({
      generatedAt: now.toISOString(),
      currency,
      timezone,
      commandCenter: {
        metrics: [
          metric('Patients in clinic', checkedInToday),
          metric('Appointments today', appointmentsToday),
          metric('Collected this month', collectedThisMonth, 'currency'),
          metric('Active treatment plans', activeTreatmentPlans),
          metric('Lab cases in progress', activeLabOrders),
        ],
        notes: [
          `${completedToday} appointments completed so far today`,
          `${followUpsDue} treatment follow-ups are due within the next 7 days`,
          `${formatMoney(outstandingBalance, currency)} still sits in receivables`,
        ],
      },
      modules: {
        patients: {
          metrics: [
            metric('Total patients', totalPatients),
            metric('New this month', newPatientsThisMonth),
            metric('Patients with balances', outstandingPatientGroups.length),
          ],
          alerts: [
            `${patientActivePlans} treatment plans are active across the patient base`,
            `${formatMoney(outstandingBalance, currency)} is tied to open patient balances`,
          ],
        },
        appointments: {
          metrics: [
            metric('Today scheduled', appointmentsToday),
            metric('Checked in now', checkedInToday),
            metric('30-day no-show rate', noShowRate, 'percentage'),
          ],
          alerts: [
            `${completedToday} visits have already been completed today`,
            `${followUpsDue} follow-up appointments should be locked in this week`,
          ],
        },
        treatments: {
          metrics: [
            metric('Plans in progress', activeTreatmentPlans),
            metric('Treatments in chair', inProgressTreatments),
            metric('Completed this month', completedTreatmentsThisMonth),
          ],
          alerts: [
            `${followUpsDue} treatment follow-ups are due within 7 days`,
            `${patientActivePlans} patient treatment plans still need coordination`,
          ],
        },
        billing: {
          metrics: [
            metric('Collected this month', collectedThisMonth, 'currency'),
            metric('Open invoices', pendingInvoiceCount),
            metric('Outstanding balance', outstandingBalance, 'currency'),
          ],
          alerts: [
            `${activePaymentPlans} active payment plans require monitoring`,
            `${openInsuranceClaims} insurance claims remain open in the revenue cycle`,
          ],
        },
        lab: {
          metrics: [
            metric('Active lab cases', activeLabOrders),
            metric('Ready for delivery', labReadyCount),
            metric('Active vendors', labVendorCount),
          ],
          alerts: [
            `${labDueSoonCount} lab cases are due within the next 7 days`,
            `${labRemakeCount} remakes need follow-up with the vendor`,
          ],
        },
        reports: {
          metrics: [
            metric('Revenue growth', revenueGrowth, 'percentage'),
            metric('No-show rate', noShowRate, 'percentage'),
            metric('Low-stock items', lowStockItems),
          ],
          alerts: [
            `${newPatientsThisMonth} new patients were added this month`,
            `${activeLabOrders} active lab cases are contributing to operational workload`,
          ],
        },
        finance: {
          metrics: [
            metric('Revenue this month', currentMonthRevenue, 'currency'),
            metric('Expenses this month', monthExpenses, 'currency'),
            metric('Net cash flow', netCashFlow, 'currency'),
          ],
          alerts: [
            `${formatMoney(avgInvoiceValue, currency)} is the average invoice value this month`,
            `${formatMoney(outstandingBalance, currency)} remains outstanding in receivables`,
          ],
        },
      },
    })
  } catch (caught) {
    console.error('ERP dashboard module summary error:', caught)
    return NextResponse.json({ error: 'Failed to load ERP summary' }, { status: 500 })
  }
}
