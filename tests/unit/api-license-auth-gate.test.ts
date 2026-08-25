import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  gate: vi.fn(),
  headerGet: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({ prisma: {}, default: {} }))
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({ get: mocks.headerGet })),
}))
vi.mock('@/lib/licensing/api-gate', () => ({
  evaluateApiLicenseGate: mocks.gate,
}))

import { requireAuthAndRole } from '@/lib/api-helpers'

describe('shared Next.js authorization license boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.headerGet.mockReturnValue('POST')
    mocks.auth.mockResolvedValue({
      user: {
        id: 'user-1',
        role: 'ADMIN',
        hospitalId: 'hospital-1',
        email: 'admin@example.test',
      },
    })
  })

  it('returns 423 after authentication when a signed decision restricts writes', async () => {
    mocks.gate.mockResolvedValue({
      state: 'expired_read_only',
      reason: 'expired',
      allows_write: false,
    })
    const result = await requireAuthAndRole(['ADMIN'])
    expect(result.error?.status).toBe(423)
    expect(await result.error?.json()).toEqual({
      error: 'License write restricted',
      code: 'LICENSE_WRITE_RESTRICTED',
      state: 'expired_read_only',
      reason: 'expired',
    })
  })

  it('does not reveal license state to unauthenticated callers', async () => {
    mocks.auth.mockResolvedValue(null)
    const result = await requireAuthAndRole(['ADMIN'])
    expect(result.error?.status).toBe(401)
    expect(mocks.gate).not.toHaveBeenCalled()
  })

  it('allows the explicit backup and license-recovery bypass', async () => {
    const result = await requireAuthAndRole(['ADMIN'], { enforceLicense: false })
    expect(result.error).toBeNull()
    expect(mocks.gate).not.toHaveBeenCalled()
  })
})
