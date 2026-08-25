import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isWorkerRequestAuthorized } from '@/lib/platform-control'

const resultSchema = z.object({
  status: z.enum(['SUCCEEDED', 'FAILED']),
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.string().max(10_000).optional(),
  version: z.string().max(100).optional(),
  backupCompleted: z.boolean().optional(),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isWorkerRequestAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const input = resultSchema.parse(await request.json())
  const operation = await prisma.platformOperation.findUnique({ where: { id } })
  if (!operation || operation.status !== 'RUNNING') {
    return NextResponse.json({ error: 'Running operation not found' }, { status: 404 })
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.platformOperation.update({
      where: { id },
      data: {
        status: input.status,
        result: (input.result ?? {}) as Prisma.InputJsonValue,
        error: input.error ?? null,
        completedAt: new Date(),
      },
    })
    if (operation.installationId && input.status === 'SUCCEEDED') {
      await transaction.platformInstallation.update({
        where: { id: operation.installationId },
        data: {
          status: 'RUNNING',
          version: input.version,
          lastBackupAt: input.backupCompleted ? new Date() : undefined,
        },
      })
    }
  })
  return NextResponse.json({ ok: true })
}
