// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { constants, generateKeyPairSync, privateDecrypt } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
const mock = vi.hoisted(() => ({
  owner: vi.fn(),
  installation: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  find: vi.fn(),
}))
vi.mock('@/lib/platform-control', () => ({ requirePlatformOwner: mock.owner }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    platformInstallation: { findUnique: mock.installation },
    platformOperation: { count: mock.count, create: mock.create, findFirst: mock.find },
  },
}))
import { GET, POST } from '@/app/api/platform/installations/[id]/operations/route'
const context = { params: Promise.resolve({ id: 'install-a' }) }
const request = (body: unknown, origin = 'https://control.example.com') =>
  new NextRequest('https://control.example.com/api/platform/installations/install-a/operations', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
beforeEach(() => {
  vi.resetAllMocks()
  process.env.NEXTAUTH_URL = 'https://control.example.com'
  mock.owner.mockResolvedValue({ user: { id: 'owner-a' } })
  mock.installation.mockResolvedValue({
    id: 'install-a',
    hostname: 'clinic.example.com',
    product: { key: 'dental-erp' },
  })
  mock.count.mockResolvedValue(0)
  mock.create.mockResolvedValue({ id: 'job-a', status: 'PENDING' })
})
describe('owner installation operations', () => {
  it('denies clinic accounts and unauthenticated calls before accessing installation data', async () => {
    mock.owner.mockResolvedValue(null)
    expect((await POST(request({ action: 'USER_LIST' }), context)).status).toBe(404)
    expect(mock.installation).not.toHaveBeenCalled()
    expect(
      (
        await GET(
          new NextRequest(
            'https://control.example.com/api/platform/installations/install-a/operations?operationId=job-a'
          ),
          context
        )
      ).status
    ).toBe(404)
    expect(mock.find).not.toHaveBeenCalled()
  })
  it('rejects cross-origin mutations', async () => {
    expect(
      (await POST(request({ action: 'USER_LIST' }, 'https://evil.example'), context)).status
    ).toBe(403)
    expect(mock.create).not.toHaveBeenCalled()
  })
  it('requires the exact installation hostname before stopping its database', async () => {
    expect(
      (
        await POST(
          request({
            action: 'DB_STOP',
            confirmHostname: 'other.example.com',
            reason: 'Planned maintenance',
          }),
          context
        )
      ).status
    ).toBe(400)
    expect(mock.create).not.toHaveBeenCalled()
  })
  it('rejects owner grants, unknown fields, and roles belonging to another product', async () => {
    for (const body of [
      { action: 'USER_UPDATE', userId: 'user-a', role: 'PLATFORM_OWNER', reason: 'Change role' },
      { action: 'USER_UPDATE', userId: 'user-a', role: 'admin', reason: 'Change role' },
      {
        action: 'USER_UPDATE',
        userId: 'user-a',
        isActive: true,
        isPlatformOwner: true,
        reason: 'Change role',
      },
    ])
      expect((await POST(request(body), context)).status).toBe(400)
    expect(mock.create).not.toHaveBeenCalled()
  })
  it('returns a temporary password once while storing only an encrypted credential', async () => {
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
    process.env.PLATFORM_USER_PUBLIC_KEY_BASE64 = Buffer.from(
      keys.publicKey.export({ type: 'spki', format: 'pem' })
    ).toString('base64')
    const response = await POST(
      request({
        action: 'USER_CREATE',
        name: 'Test Admin',
        email: 'ADMIN@example.com',
        role: 'ADMIN',
        reason: 'Authorized onboarding',
      }),
      context
    )
    expect(response.status).toBe(202)
    const body = await response.json()
    const data = mock.create.mock.calls[0][0].data
    expect(data.request.email).toBe('admin@example.com')
    expect(JSON.stringify(data)).not.toContain(body.temporaryPassword)
    const hash = privateDecrypt(
      { key: keys.privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(data.request.encryptedPassword, 'base64')
    ).toString()
    expect(await bcrypt.compare(body.temporaryPassword, hash)).toBe(true)
    expect(data.request).not.toHaveProperty('password')
    expect(data.request).not.toHaveProperty('passwordHash')
    delete process.env.PLATFORM_USER_PUBLIC_KEY_BASE64
  })
  it('scopes operation reads to the selected installation and excludes request ciphertext', async () => {
    mock.find.mockResolvedValue(null)
    const response = await GET(
      new NextRequest(
        'https://control.example.com/api/platform/installations/install-a/operations?operationId=job-other'
      ),
      context
    )
    expect(response.status).toBe(404)
    expect(mock.find.mock.calls[0][0].where).toEqual({
      id: 'job-other',
      installationId: 'install-a',
    })
    expect(mock.find.mock.calls[0][0].select).not.toHaveProperty('request')
  })
  it('rejects overlapping maintenance/provisioning jobs', async () => {
    mock.count.mockResolvedValue(1)
    expect(
      (await POST(request({ action: 'DB_START', reason: 'Resume clinic' }), context)).status
    ).toBe(409)
    expect(mock.create).not.toHaveBeenCalled()
  })
  it('queues owner demo seed/reset only for Dental ERP installations', async () => {
    for (const action of ['DEMO_SEED', 'DEMO_RESET']) {
      const response = await POST(
        request({ action, reason: 'Prepare client demonstration' }),
        context
      )
      expect(response.status).toBe(202)
      expect(mock.create.mock.calls.at(-1)?.[0].data.request).toEqual({
        action,
        reason: 'Prepare client demonstration',
      })
    }

    mock.installation.mockResolvedValue({
      id: 'install-a',
      hostname: 'clinic.example.com',
      product: { key: 'clinic-cms' },
    })
    expect(
      (
        await POST(
          request({ action: 'DEMO_SEED', reason: 'Prepare client demonstration' }),
          context
        )
      ).status
    ).toBe(400)
  })
})
