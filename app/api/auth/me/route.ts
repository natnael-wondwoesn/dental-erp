import { NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { toAuthenticatedUser } from '@/lib/auth-compat'
import { prisma } from '@/lib/prisma'

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

  return NextResponse.json(toAuthenticatedUser(currentUser))
}
