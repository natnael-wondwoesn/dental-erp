import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import prisma from '@/tests/__mocks__/prisma'

vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: async () => ({
    error: null,
    hospitalId: 'clinic-a',
    user: { role: 'ADMIN' },
  }),
}))
vi.mock('@/lib/saas/server', () => ({
  saasEnforcement: () => 'hosted',
  requestSaaSAccess: async () => ({ modules: ['core', 'patients'] }),
}))
import { GET } from '@/app/api/patients/[id]/route'

beforeEach(() => vi.clearAllMocks())

it('serves patients-only clinic without invalid empty relation counts or clinical summaries', async () => {
  vi.mocked(prisma.patient.findFirst).mockImplementation(async (query: any) => {
    const count = query.include._count
    // Real Prisma rejects a select containing only false values.
    if (count && !Object.values(count.select).some(Boolean))
      throw new Error('Empty count selection')
    return {
      id: 'patient-a',
      firstName: 'Synthetic',
      aiSummary: { diagnosis: 'private' },
      aiSummaryAt: new Date(),
    } as any
  })
  const result = await GET(new NextRequest('https://clinic.test/api/patients/patient-a'), {
    params: Promise.resolve({ id: 'patient-a' }),
  })
  expect(result.status).toBe(200)
  const body = await result.json()
  expect(body.patient.aiSummary).toBeUndefined()
  expect(body.patient.aiSummaryAt).toBeUndefined()
  const query = vi.mocked(prisma.patient.findFirst).mock.calls[0][0] as any
  expect(query.where.hospitalId).toBe('clinic-a')
  expect(query.include.medicalHistory).toBe(false)
  expect(query.include.invoices).toBe(false)
})

it('returns 404 for another clinic record under patients-only policy', async () => {
  vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
  const result = await GET(new NextRequest('https://clinic.test/api/patients/patient-b'), {
    params: Promise.resolve({ id: 'patient-b' }),
  })
  expect(result.status).toBe(404)
  expect(vi.mocked(prisma.patient.findFirst).mock.calls[0][0]?.where).toEqual({
    id: 'patient-b',
    hospitalId: 'clinic-a',
  })
})
