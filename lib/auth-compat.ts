import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { SignJWT } from 'jose'
import { z } from 'zod'
import { prisma } from './prisma'
import { resolveClinicName } from './branding'
import { isPlatformControlPlane } from './platform-mode'
import { ethiopianPhoneAliases, normalizeEthiopianPhone } from './public-booking'
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from './login-throttle'

export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).optional(),
    email: z.string().trim().min(1).optional(),
    password: z.string().min(6),
  })
  .refine((value) => value.identifier || value.email, {
    message: 'Email or mobile number is required',
    path: ['identifier'],
  })

export type UserWithAuthContext = Prisma.UserGetPayload<{
  include: {
    hospital: true
    staff: true
  }
}>

export async function authenticateCredentials(body: unknown, clientIp = 'unknown') {
  const validated = loginSchema.safeParse(body)

  if (!validated.success) {
    return { error: 'Invalid email or password format', status: 400 as const }
  }

  const { password } = validated.data
  const identifier = (validated.data.identifier || validated.data.email || '').trim()
  if (isLoginBlocked(identifier, clientIp)) {
    return { error: 'Too many sign-in attempts. Try again later.', status: 429 as const }
  }
  const normalizedEmail = z.string().email().safeParse(identifier.toLowerCase())
  const normalizedPhone = normalizeEthiopianPhone(identifier)

  if (!normalizedEmail.success && (!normalizedPhone || isPlatformControlPlane())) {
    return { error: 'Invalid email or password format', status: 400 as const }
  }

  const include = { hospital: true, staff: true } as const
  const user = normalizedEmail.success
    ? await prisma.user.findUnique({
        where: { email: normalizedEmail.data },
        include,
      })
    : await prisma.user.findFirst({
        where: { phone: { in: ethiopianPhoneAliases(normalizedPhone!) } },
        include,
      })

  if (!user || !user.isActive) {
    recordLoginFailure(identifier, clientIp)
    return { error: 'Invalid credentials', status: 401 as const }
  }

  if (!user.hospital || !user.hospital.isActive) {
    recordLoginFailure(identifier, clientIp)
    return { error: 'Your clinic account is inactive', status: 401 as const }
  }

  const passwordMatch = await bcrypt.compare(password, user.password)
  if (!passwordMatch) {
    recordLoginFailure(identifier, clientIp)
    return { error: 'Invalid credentials', status: 401 as const }
  }

  clearLoginFailures(identifier, clientIp)
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
    isPlatformOwner: user.isPlatformOwner,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(new TextEncoder().encode(secret))
}

export function toAuthenticatedUser(user: UserWithAuthContext) {
  return {
    id: user.id,
    staffId: user.staff?.id,
    hospitalId: user.hospitalId,
    email: user.email,
    name: user.name,
    roles: [user.role],
    permissions: [],
    clinicName: resolveClinicName(user.hospital.name),
    currency: user.hospital.currency,
    locale: user.locale || user.hospital.locale,
    timezone: user.hospital.timezone,
    isPlatformOwner: user.isPlatformOwner,
    isPlatformControlPlane: isPlatformControlPlane(),
    mustChangePassword: Boolean(user.mustChangePassword),
  }
}
