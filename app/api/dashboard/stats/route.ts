import { NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

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

function percentGrowth(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

function toNumber(value: { toString(): string } | number | null | undefined) {
  if (value == null) return 0
  return typeof value === 'number' ? value : Number(value.toString())
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
    const currentMonthStart = startOfMonth(now)
    const nextMonthStart = addMonths(currentMonthStart, 1)
    const previousMonthStart = addMonths(currentMonthStart, -1)
    const last7DaysStart = addDays(todayStart, -6)

    const [
      hospital,
      totalPatients,
      newPatientsThisMonth,
      previousMonthPatients,
      todayAppointments,
      completedAppointmentsToday,
      waitingPatients,
      thisMonthAppointments,
      previousMonthAppointments,
      pendingAppointments,
      thisMonthRevenueAgg,
      previousMonthRevenueAgg,
      todayRevenueAgg,
      pendingPaymentsAgg,
      totalRevenueAgg,
      monthExpensesAgg,
      activeLabOrders,
      appointmentsByStatusRaw,
      recentRevenuePayments,
      upcomingAppointmentsRaw,
      labAlertsRaw,
    ] = await Promise.all([
      prisma.hospital.findUnique({
        where: { id: hospitalId },
        select: {
          currency: true,
          timezone: true,
        },
      }),
      prisma.patient.count({
        where: {
          hospitalId,
          isActive: true,
        },
      }),
      prisma.patient.count({
        where: {
          hospitalId,
          isActive: true,
          createdAt: {
            gte: currentMonthStart,
            lt: nextMonthStart,
          },
        },
      }),
      prisma.patient.count({
        where: {
          hospitalId,
          isActive: true,
          createdAt: {
            gte: previousMonthStart,
            lt: currentMonthStart,
          },
        },
      }),
      prisma.appointment.count({
        where: {
          hospitalId,
          scheduledDate: {
            gte: todayStart,
            lt: tomorrow,
          },
        },
      }),
      prisma.appointment.count({
        where: {
          hospitalId,
          scheduledDate: {
            gte: todayStart,
            lt: tomorrow,
          },
          status: 'COMPLETED',
        },
      }),
      prisma.appointment.count({
        where: {
          hospitalId,
          scheduledDate: {
            gte: todayStart,
            lt: tomorrow,
          },
          status: 'CHECKED_IN',
        },
      }),
      prisma.appointment.count({
        where: {
          hospitalId,
          scheduledDate: {
            gte: currentMonthStart,
            lt: nextMonthStart,
          },
        },
      }),
      prisma.appointment.count({
        where: {
          hospitalId,
          scheduledDate: {
            gte: previousMonthStart,
            lt: currentMonthStart,
          },
        },
      }),
      prisma.appointment.count({
        where: {
          hospitalId,
          status: {
            in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'],
          },
        },
      }),
      prisma.payment.aggregate({
        where: {
          hospitalId,
          status: 'COMPLETED',
          paymentDate: {
            gte: currentMonthStart,
            lt: nextMonthStart,
          },
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          hospitalId,
          status: 'COMPLETED',
          paymentDate: {
            gte: previousMonthStart,
            lt: currentMonthStart,
          },
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          hospitalId,
          status: 'COMPLETED',
          paymentDate: {
            gte: todayStart,
            lt: tomorrow,
          },
        },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          hospitalId,
          balanceAmount: {
            gt: 0,
          },
        },
        _sum: { balanceAmount: true },
      }),
      prisma.payment.aggregate({
        where: {
          hospitalId,
          status: 'COMPLETED',
        },
        _sum: { amount: true },
      }),
      prisma.stockTransaction.aggregate({
        where: {
          hospitalId,
          type: 'PURCHASE',
          transactionDate: {
            gte: currentMonthStart,
            lt: nextMonthStart,
          },
        },
        _sum: { totalPrice: true },
      }),
      prisma.labOrder.count({
        where: {
          hospitalId,
          deletedAt: null,
          status: {
            in: ['CREATED', 'SENT_TO_LAB', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY'],
          },
        },
      }),
      prisma.appointment.groupBy({
        by: ['status'],
        where: {
          hospitalId,
          scheduledDate: {
            gte: currentMonthStart,
            lt: nextMonthStart,
          },
        },
        _count: {
          _all: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          hospitalId,
          status: 'COMPLETED',
          paymentDate: {
            gte: last7DaysStart,
            lt: tomorrow,
          },
        },
        select: {
          paymentDate: true,
          amount: true,
        },
        orderBy: {
          paymentDate: 'asc',
        },
      }),
      prisma.appointment.findMany({
        where: {
          hospitalId,
          scheduledDate: {
            gte: todayStart,
          },
          status: {
            in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'],
          },
        },
        select: {
          id: true,
          appointmentNo: true,
          scheduledDate: true,
          scheduledTime: true,
          appointmentType: true,
          status: true,
          chairNumber: true,
          patient: {
            select: {
              firstName: true,
              lastName: true,
              patientId: true,
            },
          },
          doctor: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
        take: 5,
      }),
      prisma.labOrder.findMany({
        where: {
          hospitalId,
          deletedAt: null,
          status: {
            in: ['CREATED', 'SENT_TO_LAB', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY'],
          },
        },
        select: {
          id: true,
          orderNumber: true,
          workType: true,
          expectedDate: true,
          status: true,
          labVendor: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ expectedDate: 'asc' }, { createdAt: 'desc' }],
        take: 5,
      }),
    ])

    if (!hospital) {
      return NextResponse.json({ error: 'Hospital not found' }, { status: 404 })
    }

    const thisMonthRevenue = toNumber(thisMonthRevenueAgg._sum.amount)
    const previousMonthRevenue = toNumber(previousMonthRevenueAgg._sum.amount)
    const todayRevenue = toNumber(todayRevenueAgg._sum.amount)
    const pendingPayments = toNumber(pendingPaymentsAgg._sum.balanceAmount)
    const totalRevenue = toNumber(totalRevenueAgg._sum.amount)
    const monthExpenses = toNumber(monthExpensesAgg._sum.totalPrice)

    const revenueByDay = new Map<string, number>()
    for (let i = 0; i < 7; i += 1) {
      const date = addDays(last7DaysStart, i)
      revenueByDay.set(date.toISOString().slice(0, 10), 0)
    }

    for (const payment of recentRevenuePayments) {
      const key = payment.paymentDate.toISOString().slice(0, 10)
      revenueByDay.set(key, (revenueByDay.get(key) || 0) + toNumber(payment.amount))
    }

    return NextResponse.json({
      overview: {
        totalPatients,
        newPatientsThisMonth,
        patientGrowth: percentGrowth(newPatientsThisMonth, previousMonthPatients),
        todayAppointments,
        thisMonthAppointments,
        appointmentGrowth: percentGrowth(thisMonthAppointments, previousMonthAppointments),
        pendingAppointments,
        completedAppointmentsToday,
        waitingPatients,
        thisMonthRevenue,
        todayRevenue,
        revenueGrowth: percentGrowth(thisMonthRevenue, previousMonthRevenue),
        pendingPayments,
        totalRevenue,
        monthExpenses,
        netCashFlow: thisMonthRevenue - monthExpenses,
        activeLabOrders,
      },
      charts: {
        last7DaysRevenue: Array.from(revenueByDay.entries()).map(([date, revenue]) => ({
          date,
          revenue,
        })),
        appointmentsByStatus: appointmentsByStatusRaw.map((item) => ({
          status: item.status,
          count: item._count._all,
        })),
      },
      recentActivity: {
        upcomingAppointments: upcomingAppointmentsRaw.map((appointment) => ({
          id: appointment.id,
          patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim(),
          patientNumber: appointment.patient.patientId,
          doctorName: `${appointment.doctor.firstName} ${appointment.doctor.lastName}`.trim(),
          date: appointment.scheduledDate.toISOString(),
          type: appointment.appointmentType,
          status: appointment.status,
          chairLabel: appointment.chairNumber == null ? null : `Chair ${appointment.chairNumber}`,
        })),
        labAlerts: labAlertsRaw.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          applianceType: order.workType,
          vendorName: order.labVendor.name,
          dueDate: order.expectedDate?.toISOString() || null,
          status: order.status,
        })),
      },
      currency: hospital.currency,
      timezone: hospital.timezone,
      generatedAt: now.toISOString(),
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 })
  }
}
