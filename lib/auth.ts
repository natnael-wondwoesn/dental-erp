import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { authConfig } from './auth.config'
import { prisma } from './prisma'
import { ethiopianPhoneAliases, normalizeEthiopianPhone } from './public-booking'
import { isPlatformControlPlane } from './platform-mode'
import { z } from 'zod'

const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).optional(),
    email: z.string().trim().min(1).optional(),
    password: z.string().min(6),
  })
  .refine((value) => value.identifier || value.email)

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const validated = loginSchema.safeParse(credentials)

        if (!validated.success) return null

        const { password } = validated.data
        const identifier = (validated.data.identifier || validated.data.email || '').trim()
        const normalizedEmail = z.string().email().safeParse(identifier.toLowerCase())
        const normalizedPhone = normalizeEthiopianPhone(identifier)

        if (!normalizedEmail.success && (!normalizedPhone || isPlatformControlPlane())) return null

        const include = { staff: true, hospital: true } as const
        const user = normalizedEmail.success
          ? await prisma.user.findUnique({ where: { email: normalizedEmail.data }, include })
          : await prisma.user.findFirst({
              where: { phone: { in: ethiopianPhoneAliases(normalizedPhone!) } },
              include,
            })

        if (!user || !user.isActive) return null

        // Check if the user's hospital is active
        if (!user.hospital || !user.hospital.isActive) return null

        const passwordMatch = await bcrypt.compare(password, user.password)
        if (!passwordMatch) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          staffId: user.staff?.id,
          hospitalId: user.hospitalId,
          isHospitalAdmin: user.isHospitalAdmin,
          isPlatformOwner: user.isPlatformOwner,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
})

// Helper function to get current user
export async function getCurrentUser() {
  const session = await auth()
  return session?.user
}

// Helper function to check if user has required role
export function hasRole(userRole: string, allowedRoles: string[]): boolean {
  return allowedRoles.includes(userRole)
}

// Role hierarchy for permission checking
export const roleHierarchy: Record<string, number> = {
  ADMIN: 5,
  DOCTOR: 4,
  ACCOUNTANT: 3,
  RECEPTIONIST: 2,
  LAB_TECH: 1,
}

export function hasMinimumRole(userRole: string, minimumRole: string): boolean {
  return (roleHierarchy[userRole] || 0) >= (roleHierarchy[minimumRole] || 0)
}
