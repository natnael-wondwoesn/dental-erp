import bcrypt from 'bcryptjs'
import { randomBytes, publicEncrypt, constants } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/platform-control'
import { prisma } from '@/lib/prisma'
import { ownerOperationSchema, productUserRoles } from '@/lib/platform-owner-operations'

const headers = { 'Cache-Control': 'no-store' }
const select = {
  id: true,
  action: true,
  status: true,
  result: true,
  error: true,
  createdAt: true,
  completedAt: true,
} as const

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requirePlatformOwner()))
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { id } = await params
  const operationId = req.nextUrl.searchParams.get('operationId')
  if (!operationId) return NextResponse.json({ error: 'Operation ID required' }, { status: 400 })
  const operation = await prisma.platformOperation.findFirst({
    where: { id: operationId, installationId: id },
    select,
  })
  if (!operation) return NextResponse.json({ error: 'Operation not found' }, { status: 404 })
  return NextResponse.json(operation, { headers })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const owner = await requirePlatformOwner()
  if (!owner) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(process.env.NEXTAUTH_URL || req.url).origin)
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const parsed = ownerOperationSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid request' },
      { status: 400 }
    )
  const { id } = await params
  const installation = await prisma.platformInstallation.findUnique({
    where: { id },
    include: { product: true },
  })
  if (!installation || !productUserRoles[installation.product.key])
    return NextResponse.json({ error: 'Unsupported installation' }, { status: 404 })
  const input = parsed.data
  if (
    (input.action === 'DEMO_SEED' || input.action === 'DEMO_RESET') &&
    installation.product.key !== 'dental-erp'
  )
    return NextResponse.json(
      { error: 'Demo data controls are available only for Dental ERP installations' },
      { status: 400 }
    )
  if (
    'role' in input &&
    input.role &&
    !productUserRoles[installation.product.key].includes(input.role)
  )
    return NextResponse.json({ error: 'Role is not supported by this product' }, { status: 400 })
  if (input.action === 'DB_STOP' && input.confirmHostname !== installation.hostname)
    return NextResponse.json(
      { error: 'Type the exact clinic hostname to stop its database' },
      { status: 400 }
    )
  // Avoid queueing over an in-progress provisioning or maintenance operation.
  const pending = await prisma.platformOperation.count({
    where: { installationId: id, status: { in: ['PENDING', 'RUNNING'] } },
  })
  if (pending)
    return NextResponse.json(
      { error: 'An operation is already pending; wait for completion' },
      { status: 409 }
    )
  let temporaryPassword: string | undefined
  let encryptedPassword: string | undefined
  if (input.action === 'USER_CREATE') {
    const publicKey = process.env.PLATFORM_USER_PUBLIC_KEY_BASE64
    if (!publicKey)
      return NextResponse.json(
        { error: 'Owner account provisioning is not configured' },
        { status: 503 }
      )
    temporaryPassword = randomBytes(18).toString('base64url') + '!9a'
    encryptedPassword = publicEncrypt(
      {
        key: Buffer.from(publicKey, 'base64').toString('utf8'),
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(
        installation.product.key === 'dental-erp'
          ? await bcrypt.hash(temporaryPassword, 12)
          : temporaryPassword
      )
    ).toString('base64')
  }
  const operation = await prisma.platformOperation.create({
    data: {
      installationId: id,
      requestedById: owner.user.id,
      action: input.action,
      request: { ...input, ...(encryptedPassword ? { encryptedPassword } : {}) },
    },
    select,
  })
  // The plaintext is returned once over HTTPS; it is never saved in job history.
  return NextResponse.json(
    { ...operation, ...(temporaryPassword ? { temporaryPassword } : {}) },
    { status: 202, headers }
  )
}
