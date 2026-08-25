import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

export const platformOperationSchema = z.enum(['PROVISION', 'DEPLOY', 'RESTART', 'BACKUP'])
export type PlatformOperationAction = z.infer<typeof platformOperationSchema>

export const customerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(63),
  contactName: z.string().trim().max(120).optional(),
  contactEmail: z.union([z.literal(''), z.email()]).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(5000).optional(),
})

export const installationSchema = z.object({
  customerId: z.string().min(1),
  productId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(63),
  hostname: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/),
  version: z.string().trim().min(1).max(100),
  licenseExpiresAt: z.string().trim().optional(),
})

export function isWorkerRequestAuthorized(header: string | null): boolean {
  const expected = process.env.PLATFORM_WORKER_TOKEN
  if (!expected || !header?.startsWith('Bearer ')) return false
  const supplied = header.slice(7)
  const left = Buffer.from(expected)
  const right = Buffer.from(supplied)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function normalizedFeatures(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === 'boolean'
    )
  )
}
