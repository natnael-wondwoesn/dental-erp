// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/licensing/api-gate', () => ({ evaluateApiLicenseGate: vi.fn() }))

import { proxy } from '@/proxy'

function request(path: string, method = 'GET') {
  return new NextRequest(new URL(path, 'https://control.example.et'), { method })
}

describe('isolated platform control plane', () => {
  beforeEach(() => {
    process.env.PRODUCT_TIER = 'full'
    process.env.PLATFORM_CONTROL_PLANE_MODE = 'true'
  })

  afterEach(() => {
    delete process.env.PRODUCT_TIER
    delete process.env.PLATFORM_CONTROL_PLANE_MODE
  })

  it.each([
    '/login',
    '/owner',
    '/api/auth/login',
    '/api/auth/me',
    '/api/platform/worker/jobs/next',
    '/api/health',
    '/api/ready',
  ])('allows only the vendor surface %s', async (path) => {
    expect((await proxy(request(path))).status).toBe(200)
  })

  it.each(['/patients', '/appointments', '/settings', '/signup', '/api/patients'])(
    'conceals the clinic surface %s',
    async (path) => {
      expect((await proxy(request(path))).status).toBe(404)
    }
  )

  it.each(['/', '/dashboard'])('redirects %s to the owner dashboard', async (path) => {
    const response = await proxy(request(path))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://control.example.et/owner')
  })
})
