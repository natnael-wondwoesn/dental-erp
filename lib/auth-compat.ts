import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { SignJWT } from 'jose'
import { z } from 'zod'
import { prisma } from './prisma'
import { resolveClinicName } from './branding'

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export type UserWithAuthContext = Prisma.UserGetPayload<{
  include: {
    hospital: true
    staff: true
  }
}>

export async function authenticateCredentials(body: unknown) {
  const validated = loginSchema.safeParse(body)

  if (!validated.success) {
    return { error: 'Invalid email or password format', status: 400 as const }
  }

  const { email, password } = validated.data

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      hospital: true,
      staff: true,
    },
  })

  if (!user || !user.isActive) {
    return { error: 'Invalid credentials', status: 401 as const }
  }

  if (!user.hospital || !user.hospital.isActive) {
    return { error: 'Your clinic account is inactive', status: 401 as const }
  }

  const passwordMatch = await bcrypt.compare(password, user.password)
  if (!passwordMatch) {
    return { error: 'Invalid credentials', status: 401 as const }
  }

  return { user }
}

export async function signAccessToken(user: UserWithAuthContext) {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is required')
  }

  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    staffId: user.staff?.id,
    hospitalId: user.hospitalId,
    isHospitalAdmin: user.isHospitalAdmin,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(new TextEncoder().encode(secret))
}

export function toAuthenticatedUser(user: UserWithAuthContext) {
  return {
    id: user.id,
    hospitalId: user.hospitalId,
    email: user.email,
    name: user.name,
    roles: [user.role],
    permissions: [],
    clinicName: resolveClinicName(user.hospital.name),
    currency: user.hospital.currency,
    locale: user.locale || user.hospital.locale,
    timezone: user.hospital.timezone,
  }
}
