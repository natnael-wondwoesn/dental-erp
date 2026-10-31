import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuthAndRole } from '@/lib/api-helpers'
import { bracesVisitSchema, visitData } from '@/lib/braces/schema'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string; visitId: string }> }

async function findVisit(hospitalId: string, patientId: string, visitId: string) {
  return prisma.bracesVisit.findFirst({
    where: { id: visitId, hospitalId, bracesCase: { patientId } },
  })
}

// PUT - edit a visit
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id, visitId } = await params
    const input = bracesVisitSchema.parse(await request.json())
    if (!(await findVisit(hospitalId, id, visitId)))
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
    const visit = await prisma.bracesVisit.update({
      where: { id: visitId },
      data: visitData(input),
    })
    return NextResponse.json({ visit })
  } catch (cause) {
    if (cause instanceof z.ZodError)
      return NextResponse.json(
        { error: cause.issues[0]?.message || 'Invalid visit data' },
        { status: 400 }
      )
    console.error('Update braces visit error:', cause)
    return NextResponse.json({ error: 'Failed to update visit' }, { status: 500 })
  }
}

// DELETE - remove a visit
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, visitId } = await params
  if (!(await findVisit(hospitalId, id, visitId)))
    return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
  await prisma.bracesVisit.delete({ where: { id: visitId } })
  return NextResponse.json({ success: true })
}
