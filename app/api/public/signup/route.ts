import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { generateUniqueSlug, generateToken, PLAN_LIMITS } from '@/lib/api-helpers'
import { Plan, Role } from '@prisma/client'
import { sendVerificationEmail } from '@/lib/email-helpers'
import { ethiopianPhoneAliases, normalizeEthiopianPhone } from '@/lib/public-booking'
import { isPlatformControlPlane } from '@/lib/platform-mode'

const signupSchema = z.object({
  hospitalName: z.string().min(2, 'Hospital name must be at least 2 characters'),
  adminName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Please enter a valid email address').optional().or(z.literal('')),
  phone: z.string().trim().min(9, 'Please enter a valid Ethiopian mobile number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = signupSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validated.error.flatten() },
        { status: 400 }
      )
    }

    const { hospitalName, adminName, password } = validated.data
    const normalizedPhone = normalizeEthiopianPhone(validated.data.phone)
    const suppliedEmail = validated.data.email?.trim().toLowerCase() || null
    const phoneSignup = !suppliedEmail

    if (!normalizedPhone) {
      return NextResponse.json(
        { error: 'Please enter a valid Ethiopian mobile number' },
        { status: 400 }
      )
    }

    if (phoneSignup && isPlatformControlPlane()) {
      return NextResponse.json({ error: 'Mobile signup is not available here' }, { status: 404 })
    }

    const existingUser = suppliedEmail
      ? await prisma.user.findUnique({ where: { email: suppliedEmail } })
      : await prisma.user.findFirst({
          where: { phone: { in: ethiopianPhoneAliases(normalizedPhone) } },
        })

    if (existingUser) {
      return NextResponse.json(
        { error: `An account with this ${phoneSignup ? 'mobile number' : 'email'} already exists` },
        { status: 409 }
      )
    }

    const accountEmail =
      suppliedEmail || `phone-${normalizedPhone.replace(/\D/g, '')}@accounts.invalid`

    // Generate unique slug for the hospital
    const slug = await generateUniqueSlug(hospitalName)

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    const verificationToken = phoneSignup ? null : generateToken(32)
    const verificationExpiry = phoneSignup ? null : new Date(Date.now() + 24 * 60 * 60 * 1000)

    // Create hospital and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the hospital with FREE plan limits
      const hospital = await tx.hospital.create({
        data: {
          name: hospitalName,
          slug,
          email: accountEmail,
          phone: normalizedPhone,
          plan: Plan.FREE,
          isActive: true,
          onboardingCompleted: false,
          patientLimit: PLAN_LIMITS.FREE.patientLimit,
          staffLimit: PLAN_LIMITS.FREE.staffLimit,
          storageLimitMb: PLAN_LIMITS.FREE.storageLimitMb,
          emailVerificationToken: verificationToken,
          emailVerificationExpiry: verificationExpiry,
        },
      })

      // Create the admin user
      const user = await tx.user.create({
        data: {
          email: accountEmail,
          name: adminName,
          password: hashedPassword,
          phone: normalizedPhone,
          role: Role.ADMIN,
          isActive: true,
          isHospitalAdmin: true,
          hospitalId: hospital.id,
          staff: {
            create: {
              employeeId: 'EMP001',
              firstName: adminName.split(' ')[0],
              lastName: adminName.split(' ').slice(1).join(' ') || '',
              email: accountEmail,
              phone: normalizedPhone,
              hospitalId: hospital.id,
            },
          },
        },
      })

      return { hospital, user }
    })

    const emailSent = phoneSignup
      ? false
      : await sendVerificationEmail({
          hospitalId: result.hospital.id,
          to: suppliedEmail!,
          userName: adminName,
          hospitalName,
          token: verificationToken!,
        })

    return NextResponse.json({
      success: true,
      message: phoneSignup
        ? 'Account created successfully. You can sign in with your mobile number.'
        : emailSent
          ? 'Account created successfully. Please check your email to verify your account.'
          : 'Account created successfully. Email verification pending — please configure SMTP settings.',
      hospitalId: result.hospital.id,
      emailSent,
      verificationRequired: !phoneSignup,
      loginIdentifier: phoneSignup ? normalizedPhone : suppliedEmail,
      // Development-only: show token for testing
      ...(process.env.NODE_ENV === 'development' && { verificationToken }),
    })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'An error occurred during signup. Please try again.' },
      { status: 500 }
    )
  }
}
