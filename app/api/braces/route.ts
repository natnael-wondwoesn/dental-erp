import { NextRequest, NextResponse } from 'next/server'

import { requireAuthAndRole } from '@/lib/api-helpers'
import { PLAN_STATUSES } from '@/lib/braces/schema'
import { prisma } from '@/lib/prisma'

// GET /api/braces - every braces case of the clinic, for the Braces page of the sidebar.
// Query: search (patient name, number or phone), status (plan status).
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR', 'RECEPTIONIST'])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim().slice(0, 80)
    const status = searchParams.get('status') || ''

    const cases = await prisma.bracesCase.findMany({
      where: {
        hospitalId,
        ...(PLAN_STATUSES.includes(status as (typeof PLAN_STATUSES)[number])
          ? {
              // "In progress" was the original name of the Active status.
              planStatus: status === 'ACTIVE' ? { in: ['ACTIVE', 'IN_PROGRESS'] } : status,
            }
          : {}),
        ...(search
          ? {
              patient: {
                OR: [
                  { patientId: { contains: search } },
                  { firstName: { contains: search } },
                  { lastName: { contains: search } },
                  { phone: { contains: search } },
                ],
              },
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        patientId: true,
        bracesType: true,
        severity: true,
        planStatus: true,
        estimatedMonths: true,
        removalDate: true,
        updatedAt: true,
        patient: { select: { patientId: true, firstName: true, lastName: true, phone: true } },
        visits: {
          orderBy: { visitDate: 'desc' },
          take: 1,
          select: { visitDate: true, nextAppointment: true },
        },
      },
    })

    return NextResponse.json({ cases })
  } catch (cause) {
    console.error('List braces cases error:', cause)
    return NextResponse.json({ error: 'Failed to load braces cases' }, { status: 500 })
  }
}
