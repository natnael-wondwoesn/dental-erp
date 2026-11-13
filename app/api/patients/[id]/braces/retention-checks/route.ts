import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuthAndRole } from '@/lib/api-helpers'
import { bracesAudit } from '@/lib/braces/audit'
import { retentionCheckData, retentionCheckSchema } from '@/lib/braces/schema'
import { prisma } from '@/lib/prisma'

// POST - add one retention check (retainer condition, compliance, relapse observed).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId, user } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const input = retentionCheckSchema.parse(await request.json())
    const patient = await prisma.patient.findFirst({ where: { id, hospitalId } })
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    const data = retentionCheckData(input)
    if (data.doctorId) {
      const doctor = await prisma.staff.findFirst({ where: { id: data.doctorId, hospitalId } })
      if (!doctor) return NextResponse.json({ error: 'Doctor not found' }, { status: 400 })
    }
    const bracesCase = await prisma.bracesCase.upsert({
      where: { hospitalId_patientId: { hospitalId, patientId: id } },
      create: { hospitalId, patientId: id },
      update: {},
    })
    const check = await prisma.bracesRetentionCheck.create({
      data: { ...data, hospitalId, bracesCaseId: bracesCase.id, createdById: user?.id ?? null },
    })
    await bracesAudit(
      hospitalId,
      user?.id,
      'BRACES_RETENTION_CHECK_CREATE',
      'BracesRetentionCheck',
      check.id
    )
    return NextResponse.json({ check }, { status: 201 })
  } catch (cause) {
    if (cause instanceof z.ZodError)
      return NextResponse.json(
        { error: cause.issues[0]?.message || 'Invalid check' },
        { status: 400 }
      )
    console.error('Create retention check error:', cause)
    return NextResponse.json({ error: 'Failed to save retention check' }, { status: 500 })
  }
}
