import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { parseAssessmentInput } from '@/lib/patient-assessment'

const include = {
  doctor: { select: { id: true, firstName: true, lastName: true } },
}

// GET /api/patients/[id]/assessments - treatment history, newest first
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const patient = await prisma.patient.findFirst({ where: { id, hospitalId } })
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    const assessments = await prisma.patientAssessment.findMany({
      where: { hospitalId, patientId: id },
      orderBy: { createdAt: 'desc' },
      include,
    })
    return NextResponse.json({ assessments })
  } catch (cause) {
    console.error('Error loading assessments:', cause)
    return NextResponse.json({ error: 'Failed to load treatments' }, { status: 500 })
  }
}

// POST /api/patients/[id]/assessments - add a new treatment note (never overwrites an earlier one; there is no edit or delete).
// The doctor is the signed-in user's staff record; the timestamp is set by the database.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId, session } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId || !session) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const parsed = parseAssessmentInput(await req.json().catch(() => null))
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const staffId = session.user.staffId
    if (!staffId) {
      return NextResponse.json(
        { error: 'Your account is not linked to a staff record.' },
        { status: 403 }
      )
    }

    const [patient, doctor] = await Promise.all([
      prisma.patient.findFirst({ where: { id, hospitalId } }),
      prisma.staff.findFirst({ where: { id: staffId, hospitalId } }),
    ])
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    if (!doctor) return NextResponse.json({ error: 'Staff record not found' }, { status: 403 })

    const treatment = await prisma.patientAssessment.create({
      data: {
        hospitalId,
        patientId: id,
        doctorId: doctor.id,
        vitalSigns: parsed.value.vitalSigns,
        others: parsed.value.others,
      },
      include,
    })
    return NextResponse.json({ assessment: treatment }, { status: 201 })
  } catch (cause) {
    console.error('Error saving assessment:', cause)
    return NextResponse.json({ error: 'Failed to save treatment' }, { status: 500 })
  }
}
