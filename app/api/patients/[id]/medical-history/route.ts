import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const patient = await prisma.patient.findFirst({
      where: { id, hospitalId },
      select: {
        id: true,
        patientId: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        dateOfBirth: true,
        gender: true,
        createdAt: true,
        medicalHistory: true,
        treatments: {
          orderBy: [{ createdAt: 'desc' }],
          take: 50,
          select: {
            id: true,
            treatmentNo: true,
            createdAt: true,
            status: true,
            diagnosis: true,
            findings: true,
            procedureNotes: true,
            toothNumbers: true,
            followUpRequired: true,
            followUpDate: true,
            cost: true,
            procedure: {
              select: {
                name: true,
                category: true,
              },
            },
            doctor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        documents: {
          where: { isArchived: false },
          orderBy: [{ createdAt: 'desc' }],
          take: 50,
          select: {
            id: true,
            originalName: true,
            documentType: true,
            description: true,
            fileType: true,
            fileSize: true,
            createdAt: true,
            treatmentId: true,
          },
        },
        _count: {
          select: {
            treatments: true,
            documents: true,
            appointments: true,
          },
        },
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      patient,
    })
  } catch (error: any) {
    console.error('Error fetching patient medical history:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch patient medical history' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const patient = await prisma.patient.findFirst({
      where: { id, hospitalId },
      select: { id: true },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const body = await req.json()
    const medicalHistory = await prisma.medicalHistory.upsert({
      where: { patientId: id },
      create: {
        patientId: id,
        hasAllergies: Boolean(body.hasAllergies),
        drugAllergies: body.drugAllergies || null,
        foodAllergies: body.foodAllergies || null,
        materialAllergies: body.materialAllergies || null,
        hasDiabetes: Boolean(body.hasDiabetes),
        diabetesType: body.diabetesType || null,
        hasHypertension: Boolean(body.hasHypertension),
        hasHeartDisease: Boolean(body.hasHeartDisease),
        heartCondition: body.heartCondition || null,
        hasBleedingDisorder: Boolean(body.hasBleedingDisorder),
        hasAsthma: Boolean(body.hasAsthma),
        hasThyroid: Boolean(body.hasThyroid),
        thyroidType: body.thyroidType || null,
        hasHepatitis: Boolean(body.hasHepatitis),
        hepatitisType: body.hepatitisType || null,
        hasHiv: Boolean(body.hasHiv),
        hasEpilepsy: Boolean(body.hasEpilepsy),
        isPregnant: Boolean(body.isPregnant),
        pregnancyWeeks: body.pregnancyWeeks ? Number(body.pregnancyWeeks) : null,
        otherConditions: body.otherConditions || null,
        currentMedications: body.currentMedications || null,
        previousDentalWork: body.previousDentalWork || null,
        lastDentalVisit: parseDate(body.lastDentalVisit),
        dentalAnxietyLevel:
          body.dentalAnxietyLevel === '' || body.dentalAnxietyLevel == null
            ? null
            : Number(body.dentalAnxietyLevel),
        familyDentalHistory: body.familyDentalHistory || null,
        smokingStatus: body.smokingStatus || 'NEVER',
        alcoholConsumption: body.alcoholConsumption || 'NEVER',
        tobaccoChewing: Boolean(body.tobaccoChewing),
        additionalNotes: body.additionalNotes || null,
      },
      update: {
        hasAllergies: Boolean(body.hasAllergies),
        drugAllergies: body.drugAllergies || null,
        foodAllergies: body.foodAllergies || null,
        materialAllergies: body.materialAllergies || null,
        hasDiabetes: Boolean(body.hasDiabetes),
        diabetesType: body.diabetesType || null,
        hasHypertension: Boolean(body.hasHypertension),
        hasHeartDisease: Boolean(body.hasHeartDisease),
        heartCondition: body.heartCondition || null,
        hasBleedingDisorder: Boolean(body.hasBleedingDisorder),
        hasAsthma: Boolean(body.hasAsthma),
        hasThyroid: Boolean(body.hasThyroid),
        thyroidType: body.thyroidType || null,
        hasHepatitis: Boolean(body.hasHepatitis),
        hepatitisType: body.hepatitisType || null,
        hasHiv: Boolean(body.hasHiv),
        hasEpilepsy: Boolean(body.hasEpilepsy),
        isPregnant: Boolean(body.isPregnant),
        pregnancyWeeks: body.pregnancyWeeks ? Number(body.pregnancyWeeks) : null,
        otherConditions: body.otherConditions || null,
        currentMedications: body.currentMedications || null,
        previousDentalWork: body.previousDentalWork || null,
        lastDentalVisit: parseDate(body.lastDentalVisit),
        dentalAnxietyLevel:
          body.dentalAnxietyLevel === '' || body.dentalAnxietyLevel == null
            ? null
            : Number(body.dentalAnxietyLevel),
        familyDentalHistory: body.familyDentalHistory || null,
        smokingStatus: body.smokingStatus || 'NEVER',
        alcoholConsumption: body.alcoholConsumption || 'NEVER',
        tobaccoChewing: Boolean(body.tobaccoChewing),
        additionalNotes: body.additionalNotes || null,
      },
    })

    return NextResponse.json({
      success: true,
      medicalHistory,
    })
  } catch (error: any) {
    console.error('Error updating patient medical history:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update patient medical history' },
      { status: 500 }
    )
  }
}
