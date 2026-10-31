import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuthAndRole } from '@/lib/api-helpers'
import { bracesVisitSchema, visitData } from '@/lib/braces/schema'
import { prisma } from '@/lib/prisma'

// POST /api/patients/[id]/braces/visits - record a follow-up visit
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const input = bracesVisitSchema.parse(await request.json())
    const data = visitData(input)

    const bracesCase = await prisma.bracesCase.findUnique({
      where: { hospitalId_patientId: { hospitalId, patientId: id } },
    })
    if (!bracesCase)
      return NextResponse.json({ error: 'Save the braces assessment first' }, { status: 409 })

    if (data.doctorId) {
      const doctor = await prisma.staff.findFirst({ where: { id: data.doctorId, hospitalId } })
      if (!doctor) return NextResponse.json({ error: 'Doctor not found' }, { status: 400 })
    }

    const visit = await prisma.bracesVisit.create({
      data: { ...data, hospitalId, bracesCaseId: bracesCase.id },
    })
    return NextResponse.json({ visit }, { status: 201 })
  } catch (cause) {
    if (cause instanceof z.ZodError)
      return NextResponse.json(
        { error: cause.issues[0]?.message || 'Invalid visit data' },
        { status: 400 }
      )
    console.error('Create braces visit error:', cause)
    return NextResponse.json({ error: 'Failed to save visit' }, { status: 500 })
  }
}
