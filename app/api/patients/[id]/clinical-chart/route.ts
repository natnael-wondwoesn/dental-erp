import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { requireAuthAndRole } from '@/lib/api-helpers'
import {
  generateClinicalSummary,
  PATIENT_CHART_TEMPLATE_NAME,
  type PatientChartData,
} from '@/lib/clinical-forms/patient-chart'
import { prisma } from '@/lib/prisma'

const text = z.string().max(20_000).optional().default('')
const chartSchema = z.object({
  visitDate: z.string().min(1),
  chiefComplaint: z.string().min(2).max(20_000),
  historyPresentIllness: text,
  pastMedicalHistory: text,
  medicalAlerts: text,
  pastDentalHistory: text,
  socialFamilyHistory: text,
  bloodPressure: z.string().max(30).optional().default(''),
  heartRate: z.string().max(30).optional().default(''),
  temperature: z.string().max(30).optional().default(''),
  extraOralExam: text,
  intraOralExam: text,
  radiographNotes: text,
  diagnosis: z.string().min(2).max(20_000),
  treatmentPlan: text,
  estimatedCost: z.string().max(100).optional().default(''),
  completedProcedures: text,
  materialsAnesthesia: text,
  postOpInstructions: text,
  nextVisit: z.string().max(500).optional().default(''),
  patientConsentName: z.string().max(200).optional().default(''),
  signature: z.string().max(2_000_000).nullable().optional(),
})

function medicalAlerts(history: any) {
  if (!history) return ''
  return [
    history.hasAllergies && history.drugAllergies && `Drug allergy: ${history.drugAllergies}`,
    history.foodAllergies && `Food allergy: ${history.foodAllergies}`,
    history.materialAllergies && `Material allergy: ${history.materialAllergies}`,
    history.hasDiabetes && `Diabetes${history.diabetesType ? ` (${history.diabetesType})` : ''}`,
    history.hasHypertension && 'Hypertension',
    history.hasHeartDisease &&
      `Heart disease${history.heartCondition ? ` (${history.heartCondition})` : ''}`,
    history.hasBleedingDisorder && 'Bleeding disorder',
    history.currentMedications && `Medication: ${history.currentMedications}`,
  ]
    .filter(Boolean)
    .join(' | ')
}

async function getTemplate(hospitalId: string) {
  const template = await prisma.formTemplate.findFirst({
    where: { hospitalId, name: PATIENT_CHART_TEMPLATE_NAME },
  })
  if (template) return template
  return prisma.formTemplate.create({
    data: {
      hospitalId,
      name: PATIENT_CHART_TEMPLATE_NAME,
      description:
        'Complete visit chart with history, examination, diagnosis, plan and progress notes.',
      type: 'CUSTOM',
      isDefault: true,
      fields: [
        { id: 'chiefComplaint', label: 'Chief Complaint', type: 'textarea' },
        { id: 'historyPresentIllness', label: 'History of Present Illness', type: 'textarea' },
        { id: 'diagnosis', label: 'Diagnosis', type: 'textarea' },
        { id: 'treatmentPlan', label: 'Treatment Plan', type: 'textarea' },
        { id: 'signature', label: 'Patient Consent', type: 'signature' },
      ],
    },
  })
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR', 'RECEPTIONIST'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const patient = await prisma.patient.findFirst({
    where: { id, hospitalId },
    include: {
      medicalHistory: true,
      dentalChart: { where: { resolvedDate: null }, orderBy: { toothNumber: 'asc' } },
      documents: {
        where: { isArchived: false, documentType: { in: ['XRAY', 'CT_SCAN'] } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const template = await prisma.formTemplate.findFirst({
    where: { hospitalId, name: PATIENT_CHART_TEMPLATE_NAME },
  })
  const charts = template
    ? await prisma.formSubmission.findMany({
        where: { hospitalId, patientId: id, templateId: template.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      })
    : []

  const age =
    patient.age ??
    (patient.dateOfBirth
      ? Math.floor((Date.now() - patient.dateOfBirth.getTime()) / 31_557_600_000)
      : null)

  return NextResponse.json({
    patient: {
      id: patient.id,
      patientId: patient.patientId,
      fullName: `${patient.firstName} ${patient.lastName}`,
      age,
      sex: patient.gender,
      medicalAlerts: medicalAlerts(patient.medicalHistory),
      medicalHistory: patient.medicalHistory,
    },
    dentalChart: patient.dentalChart,
    radiographs: patient.documents,
    charts: charts.map((chart) => ({
      id: chart.id,
      createdAt: chart.createdAt,
      signedAt: chart.signedAt,
      data: chart.data,
    })),
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId, user, session } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId || !user)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const input = chartSchema.parse(await request.json())
    const [patient, staff, template] = await Promise.all([
      prisma.patient.findFirst({ where: { id, hospitalId } }),
      prisma.staff.findFirst({ where: { hospitalId, userId: user.id } }),
      getTemplate(hospitalId),
    ])
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    const age =
      patient.age ??
      (patient.dateOfBirth
        ? Math.floor((Date.now() - patient.dateOfBirth.getTime()) / 31_557_600_000)
        : undefined)
    const count = await prisma.formSubmission.count({
      where: { hospitalId, templateId: template.id },
    })
    const base = {
      ...input,
      chartNo: `DC-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`,
      patient: {
        fullName: `${patient.firstName} ${patient.lastName}`,
        patientId: patient.patientId,
        age: age ? String(age) : '',
        sex: patient.gender || '',
      },
      clinicianName: staff
        ? `${staff.firstName} ${staff.lastName}`
        : session?.user?.name || user.name || 'Clinician',
    }
    const { signature, ...chartFields } = base
    const data: PatientChartData = {
      ...chartFields,
      clinicalSummary: generateClinicalSummary(chartFields),
    }
    const chart = await prisma.formSubmission.create({
      data: {
        hospitalId,
        templateId: template.id,
        patientId: patient.id,
        data: data as unknown as Prisma.InputJsonValue,
        signature: signature || null,
        signedAt: signature ? new Date() : null,
        status: 'APPROVED',
        reviewedBy: user.id,
        reviewedAt: new Date(),
      },
    })
    return NextResponse.json({ chart }, { status: 201 })
  } catch (cause) {
    if (cause instanceof z.ZodError)
      return NextResponse.json(
        { error: cause.issues[0]?.message || 'Invalid chart data' },
        { status: 400 }
      )
    console.error('Create clinical chart error:', cause)
    return NextResponse.json({ error: 'Failed to save clinical chart' }, { status: 500 })
  }
}
