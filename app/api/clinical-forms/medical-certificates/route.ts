import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuthAndRole } from '@/lib/api-helpers'
import { MEDICAL_CERTIFICATE_TEMPLATE_NAME } from '@/lib/clinical-forms/medical-certificate'
import { prisma } from '@/lib/prisma'

const certificateSchema = z.object({
  patientId: z.string().min(1),
  examinedAt: z.string().min(1),
  dentalDiagnosis: z.string().min(2),
  medicalDiagnosis: z.string().optional(),
  recommendation: z.string().min(2),
  city: z.string().optional(),
  subCity: z.string().optional(),
  woreda: z.string().optional(),
  leaveFrom: z.string().optional(),
  leaveTo: z.string().optional(),
})

async function getTemplate(hospitalId: string) {
  const existing = await prisma.formTemplate.findFirst({
    where: { hospitalId, name: MEDICAL_CERTIFICATE_TEMPLATE_NAME },
  })
  if (existing) return existing

  return prisma.formTemplate.create({
    data: {
      hospitalId,
      name: MEDICAL_CERTIFICATE_TEMPLATE_NAME,
      description: 'Doctor-issued medical certificate and medical leave recommendation.',
      type: 'CUSTOM',
      isDefault: true,
      fields: [
        { id: 'dentalDiagnosis', label: 'Dental diagnosis', type: 'textarea' },
        { id: 'medicalDiagnosis', label: 'Medical diagnosis', type: 'textarea' },
        { id: 'recommendation', label: 'Recommendation', type: 'textarea' },
      ],
    },
  })
}

export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR', 'RECEPTIONIST'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const template = await prisma.formTemplate.findFirst({
    where: { hospitalId, name: MEDICAL_CERTIFICATE_TEMPLATE_NAME },
  })
  if (!template) return NextResponse.json({ certificates: [] })

  const submissions = await prisma.formSubmission.findMany({
    where: { hospitalId, templateId: template.id },
    orderBy: { createdAt: 'desc' },
    take: Math.min(100, Number(request.nextUrl.searchParams.get('limit')) || 30),
  })
  const patientIds = submissions.map((item) => item.patientId).filter(Boolean) as string[]
  const patients = await prisma.patient.findMany({
    where: { hospitalId, id: { in: patientIds } },
    select: { id: true, patientId: true, firstName: true, lastName: true, email: true },
  })
  const patientMap = new Map(patients.map((patient) => [patient.id, patient]))

  return NextResponse.json({
    certificates: submissions.map((submission) => ({
      id: submission.id,
      createdAt: submission.createdAt,
      status: submission.status,
      data: submission.data,
      patient: submission.patientId ? patientMap.get(submission.patientId) || null : null,
    })),
  })
}

export async function POST(request: NextRequest) {
  const { error, hospitalId, user } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId || !user)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const input = certificateSchema.parse(await request.json())
    const [patient, staff, template] = await Promise.all([
      prisma.patient.findFirst({ where: { id: input.patientId, hospitalId } }),
      prisma.staff.findFirst({ where: { userId: user.id, hospitalId } }),
      getTemplate(hospitalId),
    ])
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    if (!staff)
      return NextResponse.json({ error: 'Doctor staff record not found' }, { status: 400 })

    const age =
      patient.age ??
      (patient.dateOfBirth
        ? Math.floor((Date.now() - patient.dateOfBirth.getTime()) / 31557600000)
        : undefined)
    const count = await prisma.formSubmission.count({
      where: { hospitalId, templateId: template.id },
    })
    const certificateNo = `MC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`
    const data = {
      ...input,
      certificateNo,
      patientFullName: `${patient.firstName} ${patient.lastName}`,
      patientEmail: patient.email || '',
      sex: patient.gender || '',
      age: age ? String(age) : '',
      cardNo: patient.patientId,
      city: input.city || patient.city || '',
      physicianName: `${staff.firstName} ${staff.lastName}`,
      physicianQualification: staff.qualification || staff.specialization || 'Dental Surgeon',
      physicianRegistration: staff.licenseNumber || '',
    }

    const submission = await prisma.formSubmission.create({
      data: {
        hospitalId,
        templateId: template.id,
        patientId: patient.id,
        data,
        status: 'APPROVED',
        reviewedBy: user.id,
        reviewedAt: new Date(),
      },
    })

    return NextResponse.json({ certificate: submission }, { status: 201 })
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      return NextResponse.json(
        { error: cause.issues[0]?.message || 'Invalid certificate data' },
        { status: 400 }
      )
    }
    console.error('Create medical certificate error:', cause)
    return NextResponse.json({ error: 'Failed to create medical certificate' }, { status: 500 })
  }
}
