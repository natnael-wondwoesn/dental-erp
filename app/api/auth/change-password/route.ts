import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'
import {
  clearLoginFailures,
  isLoginBlocked,
  loginClientIp,
  recordLoginFailure,
} from '@/lib/login-throttle'

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z
    .string()
    .min(10, 'Use at least 10 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/[0-9]/, 'Include at least one number'),
})

/**
 * POST: a signed-in user changes their OWN password. It can touch nothing else
 * and is allowed even when the clinic's subscription is write-restricted.
 */
export async function POST(request: NextRequest) {
  const { error, user } = await requireAuthAndRole(undefined, { enforceLicense: false })
  if (error || !user) return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid request' },
      { status: 400 }
    )
  }
  const { currentPassword, newPassword } = parsed.data

  const ip = loginClientIp(request.headers)
  const throttleKey = `password-change:${user.id}`
  if (isLoginBlocked(throttleKey, ip)) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in 15 minutes.' },
      { status: 429 }
    )
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, password: true },
  })
  if (!record || !(await bcrypt.compare(currentPassword, record.password))) {
    recordLoginFailure(throttleKey, ip)
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  }
  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: 'Choose a password different from the current one' },
      { status: 400 }
    )
  }

  await prisma.user.update({
    where: { id: record.id },
    data: { password: await bcrypt.hash(newPassword, 12), mustChangePassword: false },
  })
  clearLoginFailures(throttleKey, ip)
  return NextResponse.json({ success: true })
}
