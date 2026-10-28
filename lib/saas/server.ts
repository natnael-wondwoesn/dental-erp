import { headers } from 'next/headers'
import { getLicenseRuntime } from '@/lib/licensing/license-runtime'
import { moduleIds, validateModules, type SaaSAccess } from './catalog'

export function saasEnforcement() {
  const value = process.env.SAAS_ENFORCEMENT || 'disabled'
  if (!['disabled', 'hosted', 'offline'].includes(value)) throw new Error('Invalid SaaS mode')
  return value as 'disabled' | 'hosted' | 'offline'
}

export async function saasFetch(path: string, admin = false, init: RequestInit = {}) {
  const base = process.env.SAAS_URL
  const token = admin ? process.env.SAAS_ADMIN_TOKEN : process.env.SAAS_READER_TOKEN
  if (!base || !token) throw new Error('SaaS control connection is not configured')
  const requestHeaders = new Headers(init.headers)
  requestHeaders.set('Authorization', `Bearer ${token}`)
  requestHeaders.set('Content-Type', 'application/json')
  return fetch(`${base.replace(/\/$/, '')}/api/saas/${path}`, {
    ...init,
    headers: requestHeaders,
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  })
}

export async function loadSaaSAccess(tenantId: string): Promise<SaaSAccess> {
  const mode = saasEnforcement()
  const fallback: SaaSAccess = {
    tenantId,
    name: '',
    slug: '',
    hostname: null,
    customerId: '',
    mode: 'hosted',
    planName: 'Self-Hosted',
    modules: moduleIds,
    state: 'active',
    status: 'active',
    allowsWrite: true,
    revision: 0,
    accessUntil: null,
    graceUntil: null,
    monthlyFee: '0',
    currency: 'ETB',
    branding: {},
  }
  if (mode === 'disabled') return fallback
  if (mode === 'offline') {
    const decision = await getLicenseRuntime().decide()
    const payload = decision.payload
    let modules: SaaSAccess['modules'] = []
    let trusted = Boolean(
      payload &&
      process.env.SAAS_CUSTOMER_ID &&
      process.env.SAAS_TENANT_ID === tenantId &&
      payload.customer_id === process.env.SAAS_CUSTOMER_ID &&
      ['active', 'grace', 'expired_read_only'].includes(decision.state) &&
      decision.enforcement === 'required'
    )
    if (trusted && payload) {
      try {
        modules = validateModules(
          payload.entitlements.filter((key) => key.startsWith('module:')).map((key) => key.slice(7))
        )
      } catch {
        trusted = false
      }
    }
    return {
      ...fallback,
      mode: 'offline',
      modules: trusted ? modules : [],
      state: trusted ? decision.state : 'recovery',
      allowsWrite: trusted && decision.allows_write,
      accessUntil: payload?.expires_at || null,
      customerId: payload?.customer_id || '',
      branding: {},
      planName: 'Offline subscription',
    }
  }
  const response = await saasFetch(`access/${encodeURIComponent(tenantId)}`)
  if (!response.ok) throw new Error(`SaaS policy unavailable (${response.status})`)
  const access: SaaSAccess = await response.json()
  if (access.tenantId !== tenantId) throw new Error('SaaS tenant mismatch')
  access.modules = validateModules(access.modules)
  return access
}

export async function requestSaaSAccess(tenantId: string): Promise<SaaSAccess> {
  const injected = (await headers()).get('x-dental-saas-policy')
  if (injected && saasEnforcement() !== 'disabled') {
    const policy: SaaSAccess = JSON.parse(injected)
    if (policy.tenantId === tenantId) return policy
    throw new Error('SaaS tenant mismatch')
  }
  return loadSaaSAccess(tenantId)
}

export async function eligibleTenantIds(modules: string[]): Promise<string[] | undefined> {
  if (saasEnforcement() === 'disabled') return undefined
  if (saasEnforcement() === 'offline') {
    const tenant = process.env.SAAS_TENANT_ID
    if (!tenant) return []
    const policy = await loadSaaSAccess(tenant)
    return policy.allowsWrite && modules.every((key) => policy.modules.includes(key as never))
      ? [tenant]
      : []
  }
  const response = await saasFetch(`eligible?modules=${encodeURIComponent(modules.join(','))}`)
  if (!response.ok) throw new Error('Job entitlement lookup failed')
  return (await response.json()).tenantIds
}

export async function assertModuleWrite(tenantId: string, modules: string[]) {
  if (saasEnforcement() === 'disabled') return
  if (!tenantId) throw new Error('Tenant context is required')
  const policy = await loadSaaSAccess(tenantId)
  if (!policy.allowsWrite || modules.some((key) => !policy.modules.includes(key as never))) {
    throw new Error('Subscription or module does not allow this operation')
  }
}
