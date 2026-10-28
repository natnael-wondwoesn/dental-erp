// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mock = vi.hoisted(() => ({ find: vi.fn(), operation: vi.fn(), installation: vi.fn() }))
vi.mock('@/lib/platform-control', () => ({ isWorkerRequestAuthorized: () => true }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    platformOperation: { findUnique: mock.find },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        platformOperation: { update: mock.operation },
        platformInstallation: { update: mock.installation },
      }),
  },
}))
import { POST } from '@/app/api/platform/worker/jobs/[id]/result/route'
beforeEach(() => vi.clearAllMocks())
it.each([
  ['DB_STOP', 'DATABASE_STOPPED'],
  ['DB_START', 'RUNNING'],
  ['USER_LIST', undefined],
  ['USER_CREATE', undefined],
  ['STATUS', undefined],
])('reports %s without losing deliberate database state', async (action, status) => {
  mock.find.mockResolvedValue({
    id: 'job-a',
    installationId: 'install-a',
    status: 'RUNNING',
    action,
  })
  const req = new NextRequest('https://control.example.com/api/platform/worker/jobs/job-a/result', {
    method: 'POST',
    body: JSON.stringify({ status: 'SUCCEEDED', result: {} }),
  })
  expect((await POST(req, { params: Promise.resolve({ id: 'job-a' }) })).status).toBe(200)
  expect(mock.installation.mock.calls[0][0].data.status).toBe(status)
})
