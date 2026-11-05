'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  customerSchema,
  installationSchema,
  normalizedFeatures,
  platformOperationSchema,
  requirePlatformOwner,
  releaseVersionSchema,
} from '@/lib/platform-control'

async function owner() {
  const session = await requirePlatformOwner()
  if (!session) throw new Error('Platform owner access required')
  return session
}

function text(data: FormData, key: string): string {
  return String(data.get(key) ?? '').trim()
}

export async function createCustomer(data: FormData) {
  await owner()
  const input = customerSchema.parse({
    name: text(data, 'name'),
    slug: text(data, 'slug'),
    contactName: text(data, 'contactName'),
    contactEmail: text(data, 'contactEmail'),
    contactPhone: text(data, 'contactPhone'),
    notes: text(data, 'notes'),
  })
  await prisma.platformCustomer.create({ data: input })
  revalidatePath('/owner')
}

export async function createInstallation(data: FormData) {
  await owner()
  const input = installationSchema.parse({
    customerId: text(data, 'customerId'),
    productId: text(data, 'productId'),
    name: text(data, 'name'),
    slug: text(data, 'slug'),
    hostname: text(data, 'hostname'),
    version: text(data, 'version'),
    licenseExpiresAt: text(data, 'licenseExpiresAt'),
  })
  const product = await prisma.platformProduct.findUnique({ where: { id: input.productId } })
  // A landing-page-only site has no containers, database or health endpoint: it is
  // a folder of files that the web server already serves, so nothing is provisioned.
  const landing = product?.key === 'landing-site'
  const installation = await prisma.platformInstallation.create({
    data: {
      customerId: input.customerId,
      productId: input.productId,
      name: input.name,
      slug: input.slug,
      hostname: input.hostname,
      version: input.version || null,
      composeProject: `client-${input.slug}`,
      healthUrl: landing ? `https://${input.hostname}/` : `https://${input.hostname}/api/health`,
      ...(landing ? { managedByWorker: false, status: 'RUNNING' } : {}),
      licenseExpiresAt: input.licenseExpiresAt
        ? new Date(`${input.licenseExpiresAt}T23:59:59Z`)
        : null,
      features: {},
    },
  })
  const session = await owner()
  if (!landing) {
    await prisma.platformOperation.create({
      data: {
        installationId: installation.id,
        requestedById: session.user.id,
        action: 'PROVISION',
        request: { slug: installation.slug },
      },
    })
  }
  revalidatePath('/owner')
}

/** Pause or restore a landing-page-only site (for example when the fee is unpaid). */
export async function setSiteSuspended(data: FormData) {
  const session = await owner()
  const installationId = text(data, 'installationId')
  const suspend = text(data, 'suspend') === 'true'
  const reason = text(data, 'reason')
  if (reason.length < 3 || reason.length > 500)
    throw new Error('Enter a reason (3 to 500 characters)')
  const installation = await prisma.platformInstallation.findUnique({
    where: { id: installationId },
    include: { product: true },
  })
  if (!installation || installation.product.key !== 'landing-site')
    throw new Error('This action is only for landing-page sites')
  const pending = await prisma.platformOperation.count({
    where: { installationId, status: { in: ['PENDING', 'RUNNING'] } },
  })
  if (pending) throw new Error('An operation is already pending; wait for it to finish')
  const action = suspend ? 'SITE_SUSPEND' : 'SITE_RESTORE'
  await prisma.platformOperation.create({
    data: { installationId, requestedById: session.user.id, action, request: { action, reason } },
  })
  revalidatePath('/owner')
}

export async function setHandwritingEntitlement(data: FormData) {
  const session = await owner()
  const id = text(data, 'installationId')
  const enabled = text(data, 'enabled') === 'true'
  const installation = await prisma.platformInstallation.findUnique({ where: { id } })
  if (!installation) throw new Error('Installation not found')
  if (!installation.managedByWorker) {
    throw new Error('This legacy installation is inventory-only')
  }
  const features = normalizedFeatures(installation.features)
  features.handwrittenDiagnosis = enabled
  await prisma.platformInstallation.update({ where: { id }, data: { features } })
  await prisma.platformOperation.create({
    data: {
      installationId: installation.id,
      requestedById: session.user.id,
      action: 'DEPLOY',
      request: { reason: 'feature-entitlement-change' },
    },
  })
  revalidatePath('/owner')
}

export async function queueOperation(data: FormData) {
  const session = await owner()
  const installationId = text(data, 'installationId')
  const action = platformOperationSchema.parse(text(data, 'action'))
  const installation = await prisma.platformInstallation.findUnique({
    where: { id: installationId },
  })
  if (!installation) throw new Error('Installation not found')
  if (!installation.managedByWorker) throw new Error('This legacy installation is inventory-only')
  await prisma.platformOperation.create({
    data: { installationId, requestedById: session.user.id, action, request: {} },
  })
  revalidatePath('/owner')
}

export async function deployInstallationVersion(data: FormData) {
  const session = await owner()
  const installationId = text(data, 'installationId')
  const version = releaseVersionSchema.parse(text(data, 'version'))
  const installation = await prisma.platformInstallation.findUnique({
    where: { id: installationId },
  })
  if (!installation) throw new Error('Installation not found')
  if (!installation.managedByWorker) throw new Error('This legacy installation is inventory-only')
  await prisma.$transaction([
    prisma.platformInstallation.update({ where: { id: installationId }, data: { version } }),
    prisma.platformOperation.create({
      data: {
        installationId,
        requestedById: session.user.id,
        action: 'DEPLOY',
        request: { version },
      },
    }),
  ])
  revalidatePath('/owner')
}

export async function checkInstallationHealth(data: FormData) {
  await owner()
  const id = text(data, 'installationId')
  const installation = await prisma.platformInstallation.findUnique({ where: { id } })
  if (!installation?.healthUrl) throw new Error('Installation has no health URL')
  const url = new URL(installation.healthUrl)
  if (url.protocol !== 'https:' || url.hostname !== installation.hostname) {
    throw new Error('Unsafe health URL')
  }
  let status = 'UNREACHABLE'
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    status = response.ok ? 'HEALTHY' : `HTTP_${response.status}`
  } catch {
    status = 'UNREACHABLE'
  }
  await prisma.platformInstallation.update({
    where: { id },
    data: {
      lastHealthStatus: status,
      lastHealthAt: new Date(),
      status:
        installation.status === 'DATABASE_STOPPED'
          ? 'DATABASE_STOPPED'
          : status === 'HEALTHY'
            ? 'RUNNING'
            : 'DEGRADED',
    },
  })
  revalidatePath('/owner')
}
