import { NextRequest, NextResponse } from 'next/server'
import { ownerOperationActions } from '@/lib/platform-owner-operations'
import { prisma } from '@/lib/prisma'
import { isWorkerRequestAuthorized, normalizedFeatures } from '@/lib/platform-control'

export async function GET(request: NextRequest) {
  if (!isWorkerRequestAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const job = await prisma.platformOperation.findFirst({
    where: {
      status: 'PENDING',
      installationId: { not: null },
      OR: [
        { installation: { managedByWorker: true } },
        { action: { in: [...ownerOperationActions] } },
      ],
    },
    include: { installation: { include: { product: true, customer: true } } },
    orderBy: { createdAt: 'asc' },
  })
  if (!job) return new NextResponse(null, { status: 204 })

  const claimed = await prisma.platformOperation.updateMany({
    where: { id: job.id, status: 'PENDING' },
    data: { status: 'RUNNING', startedAt: new Date() },
  })
  if (claimed.count !== 1)
    return NextResponse.json({ error: 'Job already claimed' }, { status: 409 })
  if (!job.installation) {
    await prisma.platformOperation.update({
      where: { id: job.id },
      data: { status: 'FAILED', completedAt: new Date(), error: 'Installation no longer exists' },
    })
    return NextResponse.json({ error: 'Installation no longer exists' }, { status: 409 })
  }

  return NextResponse.json({
    id: job.id,
    action: job.action,
    ...(ownerOperationActions.includes(job.action as (typeof ownerOperationActions)[number])
      ? { request: job.request, requestedById: job.requestedById }
      : {}),
    installation: {
      id: job.installation.id,
      slug: job.installation.slug,
      hostname: job.installation.hostname,
      composeProject: job.installation.composeProject,
      version: job.installation.version,
      productKey: job.installation.product.key,
      customerName: job.installation.customer.name,
      features: normalizedFeatures(job.installation.features),
    },
  })
}
