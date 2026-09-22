import { NextRequest, NextResponse } from 'next/server'
import { addMonths, subDays } from 'date-fns'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'

const createRecallSchema = z.object({
  treatmentId: z.string().min(1).optional(),
  followUpMonths: z.number().int().min(1).max(24).default(6),
  reminderLeadDays: z.number().int().min(0).max(90).default(7),
  notes: z.string().trim().max(2000).optional(),
})

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR', 'RECEPTIONIST'])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: patientId } = await params
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, hospitalId },
    select: { id: true },
  })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const recalls = await prisma.patientRecall.findMany({
    where: { patientId, hospitalId },
    orderBy: { followUpDate: 'desc' },
    include: {
      treatment: {
        select: { id: true, treatmentNo: true, endTime: true },
      },
      createdBy: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ recalls })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId, session } = await requireAuthAndRole(['ADMIN', 'RECEPTIONIST'])
  if (error || !hospitalId || !session) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = createRecallSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid recall details', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { id: patientId } = await params
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, hospitalId, isActive: true },
    select: { id: true },
  })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const treatment = await prisma.treatment.findFirst({
    where: {
      hospitalId,
      patientId,
      status: 'COMPLETED',
      ...(parsed.data.treatmentId ? { id: parsed.data.treatmentId } : {}),
      endTime: { not: null },
    },
    orderBy: { endTime: 'desc' },
    select: { id: true, endTime: true },
  })

  if (!treatment?.endTime) {
    return NextResponse.json(
      { error: 'A completed treatment is required before scheduling a recall' },
      { status: 400 }
    )
  }

  const followUpDate = addMonths(treatment.endTime, parsed.data.followUpMonths)
  const reminderDate = subDays(followUpDate, parsed.data.reminderLeadDays)
  const existing = await prisma.patientRecall.findFirst({
    where: { hospitalId, patientId, followUpDate },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'A recall is already scheduled for this follow-up date', recallId: existing.id },
      { status: 409 }
    )
  }

  const recall = await prisma.patientRecall.create({
    data: {
      hospitalId,
      patientId,
      treatmentId: treatment.id,
      createdById: session.user.id,
      lastTreatmentDate: treatment.endTime,
      followUpDate,
      reminderDate,
      reminderLeadDays: parsed.data.reminderLeadDays,
      notes: parsed.data.notes,
    },
  })

  return NextResponse.json({ recall }, { status: 201 })
}
