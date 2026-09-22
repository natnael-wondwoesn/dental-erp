import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'

const updateRecallSchema = z.object({
  status: z.enum(['RETURNED', 'CANCELLED']),
  notes: z.string().trim().max(2000).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recallId: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'RECEPTIONIST'])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = updateRecallSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid recall update' }, { status: 400 })
  }

  const { id: patientId, recallId } = await params
  const recall = await prisma.patientRecall.findFirst({
    where: { id: recallId, patientId, hospitalId },
    select: { id: true, status: true },
  })
  if (!recall) return NextResponse.json({ error: 'Recall not found' }, { status: 404 })
  if (recall.status === 'RETURNED' || recall.status === 'CANCELLED') {
    return NextResponse.json(
      { error: `Recall is already ${recall.status.toLowerCase()}` },
      { status: 409 }
    )
  }

  const updated = await prisma.patientRecall.update({
    where: { id: recall.id },
    data: {
      status: parsed.data.status,
      returnedAt: parsed.data.status === 'RETURNED' ? new Date() : null,
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    },
  })

  return NextResponse.json({ recall: updated })
}
