import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
export * from '@/lib/platform-validation'

export async function requirePlatformOwner() {
  const { error, user } = await requireAuthAndRole(undefined, { enforceLicense: false })
  if (error || !user?.id) return null
  const current = await prisma.user.findUnique({ where: { id: user.id } })
  if (!current?.isActive || !current.isPlatformOwner) return null
  return { user: current }
}
