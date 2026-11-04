import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { parseExamTeeth } from '@/lib/dental-examination'

// PUT - Edit a previously saved examination
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const { examinedAt, teeth } = await request.json()
    const parsed = parseExamTeeth(teeth)
    const date = examinedAt ? new Date(examinedAt) : undefined
    if (!parsed || (date && Number.isNaN(date.getTime()))) {
      return NextResponse.json({ error: 'Invalid dental examination' }, { status: 400 })
    }

    const existing = await prisma.dentalExamination.findFirst({ where: { id, hospitalId } })
    if (!existing) return NextResponse.json({ error: 'Examination not found' }, { status: 404 })

    const examination = await prisma.dentalExamination.update({
      where: { id },
      data: { teeth: parsed, ...(date ? { examinedAt: date } : {}) },
    })
    return NextResponse.json(examination)
  } catch (err) {
    console.error('Error updating dental examination:', err)
    return NextResponse.json({ error: 'Failed to update dental examination' }, { status: 500 })
  }
}
