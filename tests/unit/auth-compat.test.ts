// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  compare: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: mocks.findUnique, findFirst: mocks.findFirst } },
}))
vi.mock('bcryptjs', () => ({ default: { compare: mocks.compare } }))

import { authenticateCredentials } from '@/lib/auth-compat'

const activeUser = {
  id: 'user-a',
  email: 'phone-251911234567@accounts.invalid',
  phone: '+251911234567',
  password: 'hashed',
  isActive: true,
  hospital: { id: 'clinic-a', isActive: true },
  staff: null,
}

describe('authenticateCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.PLATFORM_CONTROL_PLANE_MODE
    mocks.compare.mockResolvedValue(true)
  })

  it('authenticates equivalent Ethiopian mobile formats', async () => {
    mocks.findFirst.mockResolvedValue(activeUser)

    const result = await authenticateCredentials({
      identifier: '0911 234 567',
      password: 'password123',
    })

    expect(result).toEqual({ user: activeUser })
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { phone: { in: ['+251911234567', '0911234567', '251911234567'] } },
      include: { hospital: true, staff: true },
    })
  })

  it('keeps legacy email login compatible', async () => {
    mocks.findUnique.mockResolvedValue({ ...activeUser, email: 'admin@clinic.test' })

    const result = await authenticateCredentials({
      email: 'ADMIN@CLINIC.TEST',
      password: 'password123',
    })

    expect('user' in result).toBe(true)
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@clinic.test' },
      include: { hospital: true, staff: true },
    })
  })

  it('rejects mobile login on the control plane before querying users', async () => {
    process.env.PLATFORM_CONTROL_PLANE_MODE = 'true'

    const result = await authenticateCredentials({
      identifier: '+251911234567',
      password: 'password123',
    })

    expect(result).toEqual({ error: 'Invalid email or password format', status: 400 })
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })

  it('rejects an invalid identifier', async () => {
    const result = await authenticateCredentials({
      identifier: 'not-valid',
      password: 'password123',
    })

    expect(result).toEqual({ error: 'Invalid email or password format', status: 400 })
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })
})
