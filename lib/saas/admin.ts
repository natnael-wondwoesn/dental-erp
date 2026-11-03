import { notFound } from 'next/navigation'
import { requirePlatformOwner } from '@/lib/platform-control'
import { saasFetch } from '@/lib/saas/server'

/** Owner-only GET against the SaaS control API; null when the backend is unreachable. */
export async function ownerFetch<T>(path: string): Promise<T | null> {
  const owner = await requirePlatformOwner()
  if (!owner) notFound()
  try {
    const response = await saasFetch(`admin/${path}`, true, {
      headers: { 'X-Actor': owner.user.id },
    })
    return response.ok ? ((await response.json()) as T) : null
  } catch {
    return null
  }
}

export type Overview = {
  tenants: number
  byState: Record<string, number>
  moduleAdoption: Record<string, number>
  expiringSoon: { tenantId: string; name: string; accessUntil: string }[]
  monthlyRecurring: string
  currency: string
  versions: { client: string; version: string; status: string; at: string }[]
}

export type Deployment = {
  id: string
  client: string
  version: string
  previousVersion: string | null
  status: 'SUCCEEDED' | 'FAILED' | 'ROLLED_BACK'
  detail: string | null
  runUrl: string | null
  createdAt: string
}

export type AuditEvent = {
  id: string
  tenantId: string
  tenantName: string
  actor: string
  action: string
  details: Record<string, unknown>
  createdAt: string
}
