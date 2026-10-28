import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requestSaaSAccess, saasEnforcement } from '@/lib/saas/server'

// GET /api/patients/[id] - Get a specific patient with all details
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId, user } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const access = await requestSaaSAccess(hospitalId)
    const can = (module: string) => access.modules.includes(module as never)
    const clinical =
      can('clinical') &&
      (saasEnforcement() === 'disabled' || ['ADMIN', 'DOCTOR'].includes(user?.role))

    const patient = await prisma.patient.findFirst({
      where: { id, hospitalId },
      include: {
        medicalHistory: clinical,
        appointments: can('appointments')
          ? {
              take: 10,
              orderBy: { scheduledDate: 'desc' },
              include: {
                doctor: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            }
          : false,
        treatments: clinical
          ? {
              take: 10,
              orderBy: { createdAt: 'desc' },
              include: {
                procedure: {
                  select: {
                    name: true,
                    category: true,
                  },
                },
                doctor: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            }
          : false,
        invoices: can('billing')
          ? {
              take: 10,
              orderBy: { createdAt: 'desc' },
              include: {
                payments: true,
              },
            }
          : false,
        documents: clinical
          ? {
              where: { isArchived: false },
              orderBy: { createdAt: 'desc' },
              take: 20,
            }
          : false,
        dentalChart: clinical,
        _count:
          can('appointments') || clinical || can('billing')
            ? {
                select: {
                  appointments: can('appointments'),
                  treatments: clinical,
                  invoices: can('billing'),
                  documents: clinical,
                },
              }
            : false,
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const financialSummary = can('billing')
      ? await prisma.invoice.aggregate({
          where: {
            patientId: id,
            hospitalId,
            status: { notIn: ['CANCELLED', 'REFUNDED'] },
          },
          _sum: { totalAmount: true, paidAmount: true, balanceAmount: true },
          _count: true,
        })
      : null

    const visiblePatient = clinical
      ? patient
      : Object.fromEntries(
          Object.entries(patient).filter(([key]) => !['aiSummary', 'aiSummaryAt'].includes(key))
        )
    return NextResponse.json({
      success: true,
      patient: {
        ...visiblePatient,
        ...(financialSummary
          ? {
              financialSummary: {
                totalBilled: Number(financialSummary._sum.totalAmount || 0),
                totalPaid: Number(financialSummary._sum.paidAmount || 0),
                outstandingBalance: Number(financialSummary._sum.balanceAmount || 0),
                invoiceCount: financialSummary._count,
              },
            }
          : {}),
      },
    })
  } catch (error: any) {
    console.error('Error fetching patient:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch patient' }, { status: 500 })
  }
}

// PUT /api/patients/[id] - Update a patient
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await req.json()

    // Check if patient exists and belongs to this hospital
    const existingPatient = await prisma.patient.findFirst({
      where: { id, hospitalId },
    })

    if (!existingPatient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      alternatePhone,
      dateOfBirth,
      gender,
      bloodGroup,
      address,
      city,
      state,
      pincode,
      occupation,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
    } = body

    const patient = await prisma.patient.update({
      where: { id },
      data: {
        firstName,
        lastName,
        email,
        phone,
        alternatePhone,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        gender,
        bloodGroup,
        address,
        city,
        state,
        pincode,
        occupation,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelation,
        // Clear cached AI summary so it regenerates on next view
        aiSummary: Prisma.JsonNull,
        aiSummaryAt: null,
      },
    })

    return NextResponse.json({
      success: true,
      patient,
    })
  } catch (error: any) {
    console.error('Error updating patient:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update patient' },
      { status: 500 }
    )
  }
}

// DELETE /api/patients/[id] - Soft delete a patient
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const patient = await prisma.patient.findFirst({
      where: { id, hospitalId },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Cancel any pending/scheduled appointments for this patient
    await prisma.appointment.updateMany({
      where: {
        patientId: id,
        hospitalId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      data: {
        status: 'CANCELLED',
        notes: 'Auto-cancelled: Patient deactivated',
      },
    })

    // Soft delete
    await prisma.patient.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({
      success: true,
      message: 'Patient deactivated successfully',
    })
  } catch (error: any) {
    console.error('Error deleting patient:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete patient' },
      { status: 500 }
    )
  }
}
