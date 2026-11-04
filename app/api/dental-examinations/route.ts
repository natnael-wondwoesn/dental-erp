import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { parseExamTeeth } from '@/lib/dental-examination'

// GET - Saved dental examinations for a patient, newest first
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const patientId = new URL(request.url).searchParams.get('patientId')
  if (!patientId) return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 })

  try {
    const examinations = await prisma.dentalExamination.findMany({
      where: { hospitalId, patientId },
      orderBy: [{ examinedAt: 'desc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json({ examinations })
  } catch (err) {
    console.error('Error fetching dental examinations:', err)
    return NextResponse.json({ error: 'Failed to fetch dental examinations' }, { status: 500 })
  }
}

// POST - Save a new examination (never overwrites earlier ones)
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { patientId, examinedAt, teeth } = await request.json()
    const parsed = parseExamTeeth(teeth)
    const date = examinedAt ? new Date(examinedAt) : new Date()
    if (!patientId || !parsed || Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid dental examination' }, { status: 400 })
    }

    const patient = await prisma.patient.findFirst({ where: { id: patientId, hospitalId } })
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    const user = session?.user as { id?: string; name?: string } | undefined
    const examination = await prisma.dentalExamination.create({
      data: {
        hospitalId,
        patientId,
        examinedAt: date,
        dentistId: user?.id ?? null,
        dentistName: user?.name || 'Unknown dentist',
        teeth: parsed,
      },
    })
    return NextResponse.json(examination, { status: 201 })
  } catch (err) {
    console.error('Error saving dental examination:', err)
    return NextResponse.json({ error: 'Failed to save dental examination' }, { status: 500 })
  }
}
