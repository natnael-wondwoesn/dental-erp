'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  customerSchema,
  installationSchema,
  normalizedFeatures,
  platformOperationSchema,
  requirePlatformOwner,
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
  const installation = await prisma.platformInstallation.create({
    data: {
      customerId: input.customerId,
      productId: input.productId,
      name: input.name,
      slug: input.slug,
      hostname: input.hostname,
      version: input.version || null,
      composeProject: `client-${input.slug}`,
      healthUrl: `https://${input.hostname}/api/health`,
      licenseExpiresAt: input.licenseExpiresAt
        ? new Date(`${input.licenseExpiresAt}T23:59:59Z`)
        : null,
      features: {},
    },
  })
  const session = await owner()
  await prisma.platformOperation.create({
    data: {
      installationId: installation.id,
      requestedById: session.user.id,
      action: 'PROVISION',
      request: { slug: installation.slug },
    },
  })
  revalidatePath('/owner')
}

export async function setHandwritingEntitlement(data: FormData) {
  const session = await owner()
  const id = text(data, 'installationId')
  const enabled = text(data, 'enabled') === 'true'
  const installation = await prisma.platformInstallation.findUnique({ where: { id } })
  if (!installation) throw new Error('Installation not found')
  const features = normalizedFeatures(installation.features)
  features.handwrittenDiagnosis = enabled
  await prisma.platformInstallation.update({ where: { id }, data: { features } })
  if (installation.managedByWorker) {
    await prisma.platformOperation.create({
      data: {
        installationId: installation.id,
        requestedById: session.user.id,
        action: 'DEPLOY',
        request: { reason: 'feature-entitlement-change' },
      },
    })
  }
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
  const version = text(data, 'version')
  if (!version || version.length > 100) throw new Error('An exact release version is required')
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
      status: status === 'HEALTHY' ? 'RUNNING' : 'DEGRADED',
    },
  })
  revalidatePath('/owner')
}
