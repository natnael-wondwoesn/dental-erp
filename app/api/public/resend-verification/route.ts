import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { generateToken } from '@/lib/api-helpers'
import { sendVerificationEmail } from '@/lib/email-helpers'

const requestSchema = z.object({ email: z.email() })

const genericResponse = {
  success: true,
  message: 'If an unverified account exists, a verification email has been sent.',
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
  }

  const email = parsed.data.email.trim().toLowerCase()
  const hospital = await prisma.hospital.findUnique({ where: { email } })

  // Keep the response identical for unknown and already-verified accounts so
  // this public endpoint cannot be used to enumerate clinic administrators.
  if (!hospital?.emailVerificationToken) {
    return NextResponse.json(genericResponse)
  }

  const token = generateToken(32)
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await prisma.hospital.update({
    where: { id: hospital.id },
    data: {
      emailVerificationToken: token,
      emailVerificationExpiry: expiry,
    },
  })

  await sendVerificationEmail({
    hospitalId: hospital.id,
    to: hospital.email,
    userName: hospital.name,
    hospitalName: hospital.name,
    token,
  })

  return NextResponse.json(genericResponse)
}
