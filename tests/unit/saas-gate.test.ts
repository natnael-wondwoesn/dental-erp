// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { SignJWT } from 'jose'
import { accessDenial, modulesForPath, validateModules, type SaaSAccess } from '@/lib/saas/catalog'

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  hospital: vi.fn(),
  access: vi.fn(),
  patient: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findFirst: mocks.user },
    hospital: { findUnique: mocks.hospital },
    paymentLink: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/saas/server', () => ({
  saasEnforcement: () => 'hosted',
  loadSaaSAccess: mocks.access,
}))
vi.mock('@/lib/patient-auth', () => ({ getAuthenticatedPatient: mocks.patient }))

import { evaluateSaaSGate } from '@/lib/saas/gate'

const policy: SaaSAccess = {
  tenantId: 'clinic-a',
  name: 'Clinic A',
  slug: 'clinic-a',
  hostname: 'clinic.test',
  customerId: 'customer-a',
  mode: 'hosted',
  planName: 'Starter',
  modules: ['core', 'patients', 'appointments', 'clinical'],
  state: 'active',
  status: 'active',
  allowsWrite: true,
  revision: 1,
  accessUntil: '2026-12-01T00:00:00Z',
  graceUntil: '2026-12-06T00:00:00Z',
  monthlyFee: '1000.00',
  currency: 'ETB',
  branding: {},
}

async function staffRequest(path: string, method = 'GET', extra: Record<string, string> = {}) {
  const token = await new SignJWT({ hospitalId: 'clinic-a', role: 'ADMIN' })
    .setSubject('user-a')
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.NEXTAUTH_SECRET!))
  return new NextRequest(`https://clinic.test${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...extra },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.access.mockResolvedValue(structuredClone(policy))
  mocks.user.mockResolvedValue({ hospitalId: 'clinic-a' })
  mocks.patient.mockResolvedValue({ hospitalId: 'clinic-a' })
  mocks.hospital.mockResolvedValue({ id: 'clinic-a' })
})

describe('commercial catalog', () => {
  it('rejects missing dependencies and unknown grants', () => {
    expect(() => validateModules(['core', 'billing'])).toThrow('patients')
    expect(() => validateModules(['core', '*'])).toThrow()
  })
  it.each([
    ['/api/patients/a/insurance', 'insurance'],
    ['/api/patients/a/medical-history', 'clinical'],
    ['/api/patients/a/documents/b/annotations', 'clinical'],
    ['/api/staff/a/performance', 'clinical'],
    ['/api/billing/unbilled-treatments', 'clinical'],
    ['/api/data-import/ai-mapping', 'ai'],
    ['/api/patients/a/clinical-chart', 'clinical'],
    ['/api/settings/forms', 'forms'],
    ['/api/settings/import', 'data_import'],
    ['/api/lab-orders', 'lab'],
    ['/api/patient-portal/bills', 'billing'],
  ])('maps nested path %s to %s', (path, module) => {
    expect(modulesForPath(path)).toContain(module)
  })
  it('permits core workspace while denying unlicensed aggregate payloads', () => {
    expect(modulesForPath('/dashboard')).toEqual(['core'])
    expect(accessDenial(policy, '/api/dashboard/stats', 'GET')?.code).toBe('MODULE_NOT_ENABLED')
    expect(accessDenial(policy, '/api/unknown-feature', 'GET')?.code).toBe(
      'MODULE_ROUTE_UNREGISTERED'
    )
  })
})

describe('server request gate', () => {
  it('uses verified principal instead of forged tenant/policy headers', async () => {
    const result = await evaluateSaaSGate(
      await staffRequest('/api/patients', 'GET', {
        'x-tenant-id': 'clinic-b',
        'x-dental-saas-policy': JSON.stringify({ modules: ['inventory'] }),
      })
    )
    expect(result.response).toBeUndefined()
    expect(result.access?.tenantId).toBe('clinic-a')
    expect(mocks.access).toHaveBeenCalledWith('clinic-a')
  })
  it('rejects disabled modules on direct API requests', async () => {
    const result = await evaluateSaaSGate(await staffRequest('/api/inventory'))
    expect(result.response?.status).toBe(403)
  })
  it('rechecks suspension on existing tokens; retains reads and recovery', async () => {
    mocks.access.mockResolvedValue({ ...policy, state: 'suspended_read_only', allowsWrite: false })
    expect(
      (await evaluateSaaSGate(await staffRequest('/api/patients', 'POST'))).response?.status
    ).toBe(423)
    expect((await evaluateSaaSGate(await staffRequest('/api/patients'))).response).toBeUndefined()
    expect(
      (await evaluateSaaSGate(await staffRequest('/api/settings/backup'))).response
    ).toBeUndefined()
    expect(
      (await evaluateSaaSGate(await staffRequest('/api/license/import', 'POST'))).response
    ).toBeUndefined()
  })
  it('fails closed during policy outage', async () => {
    mocks.access.mockRejectedValue(new Error('Offline'))
    expect(
      (await evaluateSaaSGate(await staffRequest('/api/patients', 'POST'))).response?.status
    ).toBe(503)
  })
  it('rejects revoked users and host mismatch', async () => {
    mocks.user.mockResolvedValueOnce(null)
    expect((await evaluateSaaSGate(await staffRequest('/api/patients'))).response?.status).toBe(401)
    mocks.access.mockResolvedValue({ ...policy, hostname: 'other-clinic.test' })
    expect((await evaluateSaaSGate(await staffRequest('/api/patients'))).response?.status).toBe(403)
  })
  it('blocks public booking and portal writes for locked clinics', async () => {
    mocks.access.mockResolvedValue({
      ...policy,
      modules: [...policy.modules, 'portal'],
      allowsWrite: false,
    })
    const booking = await evaluateSaaSGate(
      new NextRequest('https://clinic.test/api/public/clinic-a/book', {
        method: 'POST',
        body: JSON.stringify({ hospitalId: 'clinic-b' }),
      })
    )
    expect(booking.response?.status).toBe(423)
    expect(
      (
        await evaluateSaaSGate(
          new NextRequest('https://clinic.test/api/patient-portal/appointments', {
            method: 'POST',
          })
        )
      ).response?.status
    ).toBe(423)
  })
  it('keeps source modules enforced for reports', async () => {
    mocks.access.mockResolvedValue({ ...policy, modules: [...policy.modules, 'reports'] })
    expect(
      (await evaluateSaaSGate(await staffRequest('/api/reports/analytics?type=financial'))).response
        ?.status
    ).toBe(403)
  })
})
