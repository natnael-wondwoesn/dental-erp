// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'

const mock = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), update: vi.fn() }))
vi.mock('@/lib/api-helpers', () => ({ requireAuthAndRole: mock.auth }))
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: mock.find, update: mock.update } },
}))
import { POST } from '@/app/api/auth/change-password/route'

const req = (body: unknown) =>
  new NextRequest('https://x.test/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeEach(async () => {
  vi.resetAllMocks()
  mock.auth.mockResolvedValue({ error: null, user: { id: 'u1' } })
  mock.find.mockResolvedValue({ id: 'u1', password: await bcrypt.hash('OldPassword1', 4) })
})

describe('change own password', () => {
  it('requires a signed-in user', async () => {
    mock.auth.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
    })
    expect((await POST(req({ currentPassword: 'a', newPassword: 'NewPassword1' }))).status).toBe(
      401
    )
    expect(mock.update).not.toHaveBeenCalled()
  })
  it('rejects a wrong current password', async () => {
    const res = await POST(req({ currentPassword: 'wrong', newPassword: 'NewPassword1' }))
    expect(res.status).toBe(400)
    expect(mock.update).not.toHaveBeenCalled()
  })
  it('rejects weak new passwords', async () => {
    expect(
      (await POST(req({ currentPassword: 'OldPassword1', newPassword: 'short1' }))).status
    ).toBe(400)
    expect(
      (await POST(req({ currentPassword: 'OldPassword1', newPassword: 'onlyletterspassword' })))
        .status
    ).toBe(400)
  })
  it('updates only this user’s password hash and clears the must-change flag', async () => {
    const res = await POST(req({ currentPassword: 'OldPassword1', newPassword: 'NewPassword1' }))
    expect(res.status).toBe(200)
    const call = mock.update.mock.calls[0]![0]
    expect(call.where).toEqual({ id: 'u1' })
    expect(Object.keys(call.data).sort()).toEqual(['mustChangePassword', 'password'])
    expect(call.data.mustChangePassword).toBe(false)
    expect(await bcrypt.compare('NewPassword1', call.data.password)).toBe(true)
  })
})
