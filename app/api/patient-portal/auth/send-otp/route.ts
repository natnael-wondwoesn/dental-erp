import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateOTP } from '@/lib/patient-auth'
import { smsService } from '@/lib/services/sms.service'

const GENERIC_RESPONSE = {
  success: true,
  message: 'If a matching patient account exists, an OTP will be sent.',
}

/**
 * POST: Send OTP to patient's phone for portal login.
 * Body: { phone, hospitalSlug }
 */
export async function POST(req: NextRequest) {
  try {
    const { phone, hospitalSlug } = (await req.json()) as {
      phone: string
      hospitalSlug: string
    }

    if (!phone || !hospitalSlug) {
      return NextResponse.json(
        { error: 'Phone number and clinic identifier are required' },
        { status: 400 }
      )
    }

    // Find hospital
    const hospital = await prisma.hospital.findUnique({
      where: { slug: hospitalSlug },
      select: { id: true, name: true, patientPortalEnabled: true },
    })

    if (!hospital) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    if (!hospital.patientPortalEnabled) {
      return NextResponse.json(
        { error: 'Patient portal is not enabled for this clinic' },
        { status: 403 }
      )
    }

    // Check patient exists at this hospital
    const patient = await prisma.patient.findFirst({
      where: { hospitalId: hospital.id, phone, isActive: true },
      select: { id: true, firstName: true },
    })

    if (!patient) {
      return NextResponse.json(GENERIC_RESPONSE)
    }

    // Rate limit: max 5 OTPs in 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000)
    const recentOTPs = await prisma.patientOTP.count({
      where: {
        hospitalId: hospital.id,
        phone,
        createdAt: { gte: tenMinAgo },
      },
    })

    if (recentOTPs >= 5) {
      return NextResponse.json(
        { error: 'Too many OTP requests. Please try again in 10 minutes.' },
        { status: 429 }
      )
    }

    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    try {
      await smsService.sendSMS({
        hospitalId: hospital.id,
        patientId: patient.id,
        phone,
        message: `${otp} is your ${hospital.name} patient portal code. It expires in 5 minutes.`,
      })
    } catch (error) {
      console.error('Patient portal OTP delivery failed:', error)
      return NextResponse.json(
        { error: 'Patient portal sign-in is temporarily unavailable' },
        { status: 503 }
      )
    }

    await prisma.patientOTP.create({
      data: {
        hospitalId: hospital.id,
        phone,
        otp,
        expiresAt,
      },
    })

    return NextResponse.json(GENERIC_RESPONSE)
  } catch (err: unknown) {
    console.error('Send OTP error:', err)
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 })
  }
}
