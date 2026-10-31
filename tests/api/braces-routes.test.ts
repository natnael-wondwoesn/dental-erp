// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))
vi.mock('@/lib/api-helpers', () => ({ requireAuthAndRole: vi.fn() }))

import { GET, PUT } from '@/app/api/patients/[id]/braces/route'
import { POST as visitPOST } from '@/app/api/patients/[id]/braces/visits/route'
import { DELETE as visitDELETE } from '@/app/api/patients/[id]/braces/visits/[visitId]/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { modulesForPath } from '@/lib/saas/catalog'
import { prisma } from '@/lib/prisma'

const ctx = { params: Promise.resolve({ id: 'p1' }) }
const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/patients/p1/braces', {
    method,
    body: body ? JSON.stringify(body) : undefined,
  })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuthAndRole).mockResolvedValue({
    error: null,
    hospitalId: 'h1',
    user: { id: 'u1' },
  } as any)
  vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as any)
})

describe('braces module gating', () => {
  it('requires the braces module (and clinical) for its API paths', () => {
    expect(modulesForPath('/api/patients/p1/braces')).toEqual(['braces', 'clinical'])
    expect(modulesForPath('/api/patients/p1/braces/visits/v1')).toEqual(['braces', 'clinical'])
  })
})

describe('braces case', () => {
  it('returns null case for a patient with no braces record', async () => {
    vi.mocked(prisma.bracesCase.findUnique).mockResolvedValue(null)
    const res = await GET(req('GET'), ctx)
    expect(await res.json()).toEqual({ bracesCase: null })
  })

  it('upserts the case scoped to hospital and patient', async () => {
    vi.mocked(prisma.bracesCase.upsert).mockResolvedValue({ id: 'c1' } as any)
    const res = await PUT(
      req('PUT', {
        findings: ['CROWDING', 'OVERBITE'],
        severity: 'MILD',
        bracesType: 'METAL',
        plannedProcedures: ['Scaling'],
        stages: [{ name: 'Alignment', status: 'PLANNED' }],
        estimatedMonths: '18',
        estimatedCost: '45000',
        removalDate: '',
        retentionFollowUps: ['2027-06-01'],
      }),
      ctx
    )
    expect(res.status).toBe(200)
    const call = vi.mocked(prisma.bracesCase.upsert).mock.calls[0][0]
    expect(call.where).toEqual({ hospitalId_patientId: { hospitalId: 'h1', patientId: 'p1' } })
    expect(call.create).toMatchObject({
      hospitalId: 'h1',
      patientId: 'p1',
      estimatedMonths: 18,
      removalDate: null,
      findings: ['CROWDING', 'OVERBITE'],
    })
  })

  it('rejects an unknown finding or severity', async () => {
    expect((await PUT(req('PUT', { findings: ['BOGUS'] }), ctx)).status).toBe(400)
    expect((await PUT(req('PUT', { severity: 'EXTREME' }), ctx)).status).toBe(400)
    expect(prisma.bracesCase.upsert).not.toHaveBeenCalled()
  })
})

describe('braces visits', () => {
  const visit = { visitDate: '2026-11-01', visitType: 'ADJUSTMENT', doctorId: 's1' }

  it('requires a saved braces case first', async () => {
    vi.mocked(prisma.bracesCase.findUnique).mockResolvedValue(null)
    expect((await visitPOST(req('POST', visit), ctx)).status).toBe(409)
  })

  it('rejects a doctor from another hospital', async () => {
    vi.mocked(prisma.bracesCase.findUnique).mockResolvedValue({ id: 'c1' } as any)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue(null)
    expect((await visitPOST(req('POST', visit), ctx)).status).toBe(400)
    expect(prisma.bracesVisit.create).not.toHaveBeenCalled()
  })

  it('creates a visit for the case', async () => {
    vi.mocked(prisma.bracesCase.findUnique).mockResolvedValue({ id: 'c1' } as any)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({ id: 's1' } as any)
    vi.mocked(prisma.bracesVisit.create).mockResolvedValue({ id: 'v1' } as any)
    const res = await visitPOST(req('POST', visit), ctx)
    expect(res.status).toBe(201)
    expect(vi.mocked(prisma.bracesVisit.create).mock.calls[0][0].data).toMatchObject({
      hospitalId: 'h1',
      bracesCaseId: 'c1',
      visitType: 'ADJUSTMENT',
    })
  })

  it('404s when deleting a visit outside the patient/hospital', async () => {
    vi.mocked(prisma.bracesVisit.findFirst).mockResolvedValue(null)
    const res = await visitDELETE(req('DELETE'), {
      params: Promise.resolve({ id: 'p1', visitId: 'v9' }),
    })
    expect(res.status).toBe(404)
    expect(prisma.bracesVisit.delete).not.toHaveBeenCalled()
  })
})
