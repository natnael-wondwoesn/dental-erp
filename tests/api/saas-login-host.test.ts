// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
vi.mock('@/lib/auth-compat', () => ({
  authenticateCredentials: async () => ({ user: { hospitalId: 'clinic-a' } }),
  signAccessToken: async () => 'test-token',
  toAuthenticatedUser: () => ({ id: 'user-a' }),
}))
vi.mock('@/lib/saas/server', () => ({
  saasEnforcement: () => 'hosted',
  loadSaaSAccess: async () => ({ hostname: 'clinic.example.com' }),
}))
import { POST } from '@/app/api/auth/login/route'
it('accepts clinic Host when Next internal URL differs behind reverse proxy', async () => {
  const response = await POST(
    new NextRequest('http://0.0.0.0:3000/api/auth/login', {
      method: 'POST',
      headers: { host: 'clinic.example.com', 'Content-Type': 'application/json' },
      body: '{}',
    })
  )
  expect(response.status).toBe(200)
  expect((await response.json()).accessToken).toBe('test-token')
})
it('still denies a different clinic Host despite a forged forwarded host', async () => {
  const response = await POST(
    new NextRequest('http://0.0.0.0:3000/api/auth/login', {
      method: 'POST',
      headers: {
        host: 'other.example.com',
        'x-forwarded-host': 'clinic.example.com',
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
  )
  expect(response.status).toBe(403)
})
