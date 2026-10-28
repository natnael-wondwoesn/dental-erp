import { NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { toAuthenticatedUser } from '@/lib/auth-compat'
import { prisma } from '@/lib/prisma'
import { loadSaaSAccess, saasEnforcement } from '@/lib/saas/server'

export async function GET() {
  const { error, user } = await requireAuthAndRole()
  if (error || !user?.id) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      hospital: true,
      staff: true,
    },
  })

  if (!currentUser || !currentUser.isActive || !currentUser.hospital?.isActive) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const identity = toAuthenticatedUser(currentUser)
  if (saasEnforcement() !== 'disabled') {
    try {
      const saas = await loadSaaSAccess(currentUser.hospitalId)
      return NextResponse.json({
        ...identity,
        clinicName: saas.branding.displayName || saas.name || identity.clinicName,
        saas,
      })
    } catch {
      return NextResponse.json({
        ...identity,
        saas: {
          tenantId: currentUser.hospitalId,
          name: identity.clinicName,
          modules: [],
          state: 'recovery',
          allowsWrite: false,
          branding: {},
          planName: 'Subscription unavailable',
        },
      })
    }
  }
  return NextResponse.json(identity)
}
