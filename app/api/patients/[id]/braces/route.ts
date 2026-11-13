import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuthAndRole } from '@/lib/api-helpers'
import { bracesCaseSchema, caseData } from '@/lib/braces/schema'
import { bracesAudit } from '@/lib/braces/audit'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// GET /api/patients/[id]/braces - braces case with its visits (null until first save)
export async function GET(_request: NextRequest, { params }: Ctx) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR', 'RECEPTIONIST'])
  if (error || !hospitalId) return error || unauthorized()
  const { id } = await params

  const patient = await prisma.patient.findFirst({ where: { id, hospitalId } })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const bracesCase = await prisma.bracesCase.findUnique({
    where: { hospitalId_patientId: { hospitalId, patientId: id } },
    include: {
      visits: {
        orderBy: { visitDate: 'desc' },
        include: { doctor: { select: { id: true, firstName: true, lastName: true } } },
      },
      assessments: { orderBy: { assessedAt: 'desc' } },
      media: { orderBy: { capturedAt: 'desc' } },
      retentionChecks: { orderBy: { checkDate: 'desc' } },
    },
  })
  if (!bracesCase) return NextResponse.json({ bracesCase: null })

  // Files are stored as Documents; attach the file details to each categorised record.
  const documents = bracesCase.media.length
    ? await prisma.document.findMany({
        where: { hospitalId, patientId: id, id: { in: bracesCase.media.map((m) => m.documentId) } },
        select: { id: true, originalName: true, fileType: true, fileSize: true },
      })
    : []
  const byId = new Map(documents.map((d) => [d.id, d]))

  // Money stays in the central billing module; this only reads it for the case overview.
  const invoices = await prisma.invoice.findMany({
    where: { hospitalId, patientId: id, status: { notIn: ['CANCELLED', 'REFUNDED', 'DRAFT'] } },
    select: { totalAmount: true, paidAmount: true, balanceAmount: true },
  })
  const sum = (key: 'totalAmount' | 'paidAmount' | 'balanceAmount') =>
    invoices.reduce((total, inv) => total + Number(inv[key]), 0)

  return NextResponse.json({
    bracesCase: {
      ...bracesCase,
      media: bracesCase.media.map((m) => ({ ...m, document: byId.get(m.documentId) ?? null })),
    },
    billing: { total: sum('totalAmount'), paid: sum('paidAmount'), balance: sum('balanceAmount') },
  })
}

// PUT /api/patients/[id]/braces - create or update the case (assessment, plan, retention)
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { error, hospitalId, user } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId) return error || unauthorized()

  try {
    const { id } = await params
    const input = bracesCaseSchema.parse(await request.json())
    const patient = await prisma.patient.findFirst({ where: { id, hospitalId } })
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    const data = caseData(input)
    const bracesCase = await prisma.bracesCase.upsert({
      where: { hospitalId_patientId: { hospitalId, patientId: id } },
      create: { ...data, hospitalId, patientId: id },
      update: data,
    })
    await bracesAudit(hospitalId, user?.id, 'BRACES_CASE_SAVE', 'BracesCase', bracesCase.id, {
      planStatus: bracesCase.planStatus,
    })
    return NextResponse.json({ bracesCase })
  } catch (cause) {
    if (cause instanceof z.ZodError)
      return NextResponse.json(
        { error: cause.issues[0]?.message || 'Invalid braces data' },
        { status: 400 }
      )
    console.error('Save braces case error:', cause)
    return NextResponse.json({ error: 'Failed to save braces case' }, { status: 500 })
  }
}
