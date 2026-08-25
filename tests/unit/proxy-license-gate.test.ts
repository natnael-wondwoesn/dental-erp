// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ gate: vi.fn() }))
vi.mock('@/lib/licensing/api-gate', () => ({ evaluateApiLicenseGate: mocks.gate }))

import { proxy } from '@/proxy'

function request(path: string, method = 'POST', headers?: HeadersInit): NextRequest {
  return new NextRequest(new URL(path, 'https://clinic.example.et'), { method, headers })
}

describe('deny-by-default API license proxy', () => {
  beforeEach(() => {
    process.env.PRODUCT_TIER = 'full'
    mocks.gate.mockReset().mockResolvedValue(null)
  })

  afterEach(() => {
    delete process.env.PRODUCT_TIER
  })

  it('blocks an unsafe public route that has no staff authorization helper', async () => {
    mocks.gate.mockResolvedValue({ state: 'expired_read_only', reason: 'expired' })
    const response = await proxy(request('/api/public/sunny-smile/book'))
    expect(response.status).toBe(423)
    expect(await response.json()).toMatchObject({
      code: 'LICENSE_WRITE_RESTRICTED',
      state: 'expired_read_only',
      reason: 'expired',
    })
  })

  it('does not consult license state for reads', async () => {
    expect((await proxy(request('/api/patients', 'GET'))).status).toBe(200)
    expect(mocks.gate).not.toHaveBeenCalled()
  })

  it.each([
    '/api/auth/login',
    '/api/patient-portal/auth/verify-otp',
    '/api/license/import',
    '/api/settings/backup',
    '/api/health',
  ])('keeps the explicit recovery path %s available', async (path) => {
    expect((await proxy(request(path))).status).toBe(200)
    expect(mocks.gate).not.toHaveBeenCalled()
  })

  it('overwrites a client-supplied request-method marker', async () => {
    const response = await proxy(
      request('/api/patients', 'GET', { 'x-sunny-smile-request-method': 'POST' })
    )
    expect(response.headers.get('x-middleware-request-x-sunny-smile-request-method')).toBe('GET')
  })
})
