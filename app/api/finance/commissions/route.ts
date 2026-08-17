import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'

const PROCEDURE_CATEGORIES = [
  'PREVENTIVE',
  'RESTORATIVE',
  'ENDODONTIC',
  'PERIODONTIC',
  'PROSTHODONTIC',
  'ORTHODONTIC',
  'ORAL_SURGERY',
  'COSMETIC',
  'DIAGNOSTIC',
  'EMERGENCY',
] as const

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(23, 59, 59, 999)
  return value
}

function toNumber(value: { toString(): string } | number | null | undefined) {
  if (value == null) return 0
  return typeof value === 'number' ? value : Number(value.toString())
}

function sanitizeRate(value: unknown, fallback = 0) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.round(parsed * 100) / 100
}

function parseCategoryRates(value: string | null | undefined) {
  if (!value) return {}

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed).map(([key, rate]) => [key, sanitizeRate(rate, 0)])
    ) as Record<string, number>
  } catch {
    return {}
  }
}

export async function GET(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const now = new Date()
    const start = startDate ? new Date(startDate) : startOfMonth(now)
    const end = endDate ? endOfDay(new Date(endDate)) : endOfDay(now)

    const [hospital, settings, doctors] = await Promise.all([
      prisma.hospital.findUnique({
        where: { id: hospitalId },
        select: { currency: true },
      }),
      prisma.setting.findMany({
        where: {
          hospitalId,
          category: 'finance',
          key: { in: ['finance.defaultCommissionRate', 'finance.categoryRates'] },
        },
      }),
      prisma.staff.findMany({
        where: {
          hospitalId,
          isActive: true,
          user: {
            is: {
              role: 'DOCTOR',
            },
          },
        },
        include: {
          user: {
            select: {
              role: true,
            },
          },
          treatments: {
            where: {
              hospitalId,
              status: 'COMPLETED',
              OR: [
                {
                  endTime: {
                    gte: start,
                    lte: end,
                  },
                },
                {
                  endTime: null,
                  createdAt: {
                    gte: start,
                    lte: end,
                  },
                },
              ],
            },
            select: {
              id: true,
              treatmentNo: true,
              cost: true,
              endTime: true,
              createdAt: true,
              procedure: {
                select: {
                  name: true,
                  category: true,
                },
              },
              patient: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  patientId: true,
                },
              },
            },
          },
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
    ])

    const defaultRateSetting = settings.find((item) => item.key === 'finance.defaultCommissionRate')
    const categoryRatesSetting = settings.find((item) => item.key === 'finance.categoryRates')
    const defaultRate = sanitizeRate(defaultRateSetting?.value ?? 12, 12)
    const categoryRates = parseCategoryRates(categoryRatesSetting?.value)
    const currency = hospital?.currency || 'ETB'

    const doctorSummaries = doctors
      .map((doctor) => {
        let revenue = 0
        let commission = 0
        const categorySummary: Record<
          string,
          { category: string; count: number; revenue: number; commission: number; rate: number }
        > = {}

        doctor.treatments.forEach((treatment) => {
          const category = treatment.procedure.category
          const rate = categoryRates[category] ?? defaultRate
          const treatmentRevenue = toNumber(treatment.cost)
          const treatmentCommission = (treatmentRevenue * rate) / 100

          revenue += treatmentRevenue
          commission += treatmentCommission

          if (!categorySummary[category]) {
            categorySummary[category] = {
              category,
              count: 0,
              revenue: 0,
              commission: 0,
              rate,
            }
          }

          categorySummary[category].count += 1
          categorySummary[category].revenue += treatmentRevenue
          categorySummary[category].commission += treatmentCommission
        })

        return {
          id: doctor.id,
          employeeId: doctor.employeeId,
          name: `${doctor.firstName} ${doctor.lastName}`,
          specialization: doctor.specialization,
          treatmentCount: doctor.treatments.length,
          revenue,
          commission,
          effectiveRate: revenue > 0 ? Number(((commission / revenue) * 100).toFixed(2)) : defaultRate,
          categories: Object.values(categorySummary).sort((left, right) =>
            right.revenue - left.revenue
          ),
          treatments: doctor.treatments.map((treatment) => ({
            id: treatment.id,
            treatmentNo: treatment.treatmentNo,
            procedureName: treatment.procedure.name,
            category: treatment.procedure.category,
            patientName: `${treatment.patient.firstName} ${treatment.patient.lastName}`,
            patientId: treatment.patient.patientId,
            revenue: toNumber(treatment.cost),
            rate: categoryRates[treatment.procedure.category] ?? defaultRate,
            performedAt: treatment.endTime || treatment.createdAt,
          })),
        }
      })
      .sort((left, right) => right.commission - left.commission)

    const summary = doctorSummaries.reduce(
      (acc, doctor) => {
        acc.totalRevenue += doctor.revenue
        acc.totalCommission += doctor.commission
        acc.totalTreatments += doctor.treatmentCount
        return acc
      },
      { totalRevenue: 0, totalCommission: 0, totalTreatments: 0 }
    )

    return NextResponse.json({
      currency,
      period: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      },
      config: {
        defaultRate,
        categoryRates,
      },
      categories: PROCEDURE_CATEGORIES,
      summary: {
        ...summary,
        doctorCount: doctorSummaries.length,
        averageEffectiveRate:
          summary.totalRevenue > 0
            ? Number(((summary.totalCommission / summary.totalRevenue) * 100).toFixed(2))
            : defaultRate,
      },
      doctors: doctorSummaries,
    })
  } catch (error: any) {
    console.error('Error fetching commission data:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch commission data' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'ACCOUNTANT'])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const defaultRate = sanitizeRate(body.defaultRate, 12)
    const categoryRates = Object.fromEntries(
      PROCEDURE_CATEGORIES.map((category) => [
        category,
        sanitizeRate(body.categoryRates?.[category], defaultRate),
      ])
    )

    await prisma.$transaction([
      prisma.setting.upsert({
        where: {
          hospitalId_key: {
            hospitalId,
            key: 'finance.defaultCommissionRate',
          },
        },
        create: {
          hospitalId,
          category: 'finance',
          key: 'finance.defaultCommissionRate',
          value: String(defaultRate),
          type: 'number',
          description: 'Default dentist commission rate as a percentage.',
        },
        update: {
          value: String(defaultRate),
          type: 'number',
          description: 'Default dentist commission rate as a percentage.',
        },
      }),
      prisma.setting.upsert({
        where: {
          hospitalId_key: {
            hospitalId,
            key: 'finance.categoryRates',
          },
        },
        create: {
          hospitalId,
          category: 'finance',
          key: 'finance.categoryRates',
          value: JSON.stringify(categoryRates),
          type: 'json',
          description: 'Dentist commission overrides by procedure category.',
        },
        update: {
          value: JSON.stringify(categoryRates),
          type: 'json',
          description: 'Dentist commission overrides by procedure category.',
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      config: {
        defaultRate,
        categoryRates,
      },
    })
  } catch (error: any) {
    console.error('Error updating commission settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update commission settings' },
      { status: 500 }
    )
  }
}
