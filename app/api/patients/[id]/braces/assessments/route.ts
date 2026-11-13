import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuthAndRole } from '@/lib/api-helpers'
import { bracesAudit } from '@/lib/braces/audit'
import { assessmentData, bracesAssessmentSchema } from '@/lib/braces/schema'
import { prisma } from '@/lib/prisma'

// POST - record a NEW dated assessment. Earlier assessments are never edited or replaced.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId, user } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const input = bracesAssessmentSchema.parse(await request.json())
    const patient = await prisma.patient.findFirst({ where: { id, hospitalId } })
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    const data = assessmentData(input)
    if (data.doctorId) {
      const doctor = await prisma.staff.findFirst({ where: { id: data.doctorId, hospitalId } })
      if (!doctor) return NextResponse.json({ error: 'Doctor not found' }, { status: 400 })
    }
    const bracesCase = await prisma.bracesCase.upsert({
      where: { hospitalId_patientId: { hospitalId, patientId: id } },
      create: { hospitalId, patientId: id },
      update: {},
    })
    const assessment = await prisma.bracesAssessment.create({
      data: { ...data, hospitalId, bracesCaseId: bracesCase.id, createdById: user?.id ?? null },
    })
    await bracesAudit(
      hospitalId,
      user?.id,
      'BRACES_ASSESSMENT_CREATE',
      'BracesAssessment',
      assessment.id
    )
    return NextResponse.json({ assessment }, { status: 201 })
  } catch (cause) {
    if (cause instanceof z.ZodError)
      return NextResponse.json(
        { error: cause.issues[0]?.message || 'Invalid assessment' },
        { status: 400 }
      )
    console.error('Create braces assessment error:', cause)
    return NextResponse.json({ error: 'Failed to save assessment' }, { status: 500 })
  }
}
