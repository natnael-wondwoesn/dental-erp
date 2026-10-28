import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

/** Read-only clinical continuity. No operational mutations or entitlement edits. */
export async function GET(request: NextRequest) {
  const { error, hospitalId, user } = await requireAuthAndRole(undefined, { enforceLicense: false })
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = request.nextUrl.searchParams.get('id')
  const search = (request.nextUrl.searchParams.get('search') || '').slice(0, 100)
  if (id) {
    const clinical = ['ADMIN', 'DOCTOR'].includes(user.role)
    const patient = await prisma.patient.findFirst({
      where: { id, hospitalId },
      include: {
        medicalHistory: clinical,
        dentalChart: clinical,
        treatments: clinical
          ? {
              orderBy: { createdAt: 'desc' },
              take: 100,
              include: { procedure: { select: { name: true } } },
            }
          : false,
        prescriptions: clinical
          ? { take: 50, orderBy: { createdAt: 'desc' }, include: { medications: true } }
          : false,
      },
    })
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    return NextResponse.json({ patient }, { headers: { 'Cache-Control': 'no-store' } })
  }
  const patients = await prisma.patient.findMany({
    where: {
      hospitalId,
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { patientId: { contains: search } },
        { phone: { contains: search } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, patientId: true, phone: true },
    take: 50,
  })
  return NextResponse.json({ patients }, { headers: { 'Cache-Control': 'no-store' } })
}
