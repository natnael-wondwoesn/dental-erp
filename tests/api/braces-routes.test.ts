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

describe('braces list (sidebar page)', () => {
  it('is gated by the braces module and scoped to the clinic', async () => {
    const { GET: list } = await import('@/app/api/braces/route')
    expect(modulesForPath('/api/braces')).toEqual(['braces', 'clinical'])
    expect(modulesForPath('/braces')).toEqual(['braces', 'clinical'])
    vi.mocked(prisma.bracesCase.findMany).mockResolvedValue([{ id: 'c1' }] as any)
    const res = await list(
      new NextRequest('http://localhost/api/braces?status=IN_PROGRESS&search=ab')
    )
    expect((await res.json()).cases).toHaveLength(1)
    const args = vi.mocked(prisma.bracesCase.findMany).mock.calls[0][0] as any
    expect(args.where.hospitalId).toBe('h1')
    expect(args.where.planStatus).toBe('IN_PROGRESS')
  })
})

describe('braces clinical structure', () => {
  const post = (path: string, body: unknown) =>
    new NextRequest(`http://localhost/api/patients/p1/braces/${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    vi.mocked(prisma.bracesCase.upsert).mockResolvedValue({ id: 'c1' } as any)
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)
  })

  it('saves a NEW dated assessment each time and never edits an old one', async () => {
    const { POST } = await import('@/app/api/patients/[id]/braces/assessments/route')
    vi.mocked(prisma.bracesAssessment.create).mockResolvedValue({ id: 'a1' } as any)
    const res = await POST(
      post('assessments', {
        assessedAt: '2026-11-12',
        overjetMm: '4.5',
        molarRight: 'CLASS_II',
        crossbite: ['ANTERIOR'],
      }),
      ctx
    )
    expect(res.status).toBe(201)
    const args = vi.mocked(prisma.bracesAssessment.create).mock.calls[0][0] as any
    expect(args.data.hospitalId).toBe('h1')
    expect(args.data.bracesCaseId).toBe('c1')
    expect(Number(args.data.overjetMm)).toBe(4.5)
    expect(args.data.createdById).toBe('u1')
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })

  it('rejects an unknown classification value', async () => {
    const { POST } = await import('@/app/api/patients/[id]/braces/assessments/route')
    const res = await POST(
      post('assessments', { assessedAt: '2026-11-12', molarRight: 'CLASS_X' }),
      ctx
    )
    expect(res.status).toBe(400)
  })

  it('categorises an uploaded file and rejects a category of the wrong kind', async () => {
    const { POST } = await import('@/app/api/patients/[id]/braces/media/route')
    vi.mocked(prisma.document.findFirst).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(prisma.bracesMedia.create).mockResolvedValue({
      id: 'm1',
      kind: 'PHOTO',
      category: 'OPG',
    } as any)
    const wrong = await POST(
      post('media', { documentId: 'd1', kind: 'PHOTO', category: 'OPG', capturedAt: '2026-11-12' }),
      ctx
    )
    expect(wrong.status).toBe(400)
    const ok = await POST(
      post('media', {
        documentId: 'd1',
        kind: 'PHOTO',
        category: 'INTRAORAL_FRONTAL_BITE',
        stage: 'BEFORE_BRACES',
        capturedAt: '2026-11-12',
      }),
      ctx
    )
    expect(ok.status).toBe(201)
  })

  it('does not link a file that belongs to another patient or clinic', async () => {
    const { POST } = await import('@/app/api/patients/[id]/braces/media/route')
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null)
    const res = await POST(
      post('media', {
        documentId: 'other',
        kind: 'XRAY',
        category: 'OPG',
        capturedAt: '2026-11-12',
      }),
      ctx
    )
    expect(res.status).toBe(404)
  })

  it('archives the file instead of destroying it when a record is removed', async () => {
    const { DELETE } = await import('@/app/api/patients/[id]/braces/media/[mediaId]/route')
    vi.mocked(prisma.bracesMedia.findFirst).mockResolvedValue({
      id: 'm1',
      documentId: 'd1',
      kind: 'XRAY',
      category: 'OPG',
    } as any)
    const res = await DELETE(post('media/m1', {}), {
      params: Promise.resolve({ id: 'p1', mediaId: 'm1' }),
    })
    expect(res.status).toBe(200)
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: 'd1', hospitalId: 'h1' },
      data: { isArchived: true },
    })
  })

  it('records retention checks as separate records', async () => {
    const { POST } = await import('@/app/api/patients/[id]/braces/retention-checks/route')
    vi.mocked(prisma.bracesRetentionCheck.create).mockResolvedValue({ id: 'r1' } as any)
    const res = await POST(
      post('retention-checks', {
        checkDate: '2026-11-12',
        retainerCondition: 'GOOD',
        relapse: 'None',
      }),
      ctx
    )
    expect(res.status).toBe(201)
  })

  it('accepts the new visit fields and keeps old visit types valid', async () => {
    const { bracesVisitSchema } = await import('@/lib/braces/schema')
    expect(
      bracesVisitSchema.safeParse({
        visitDate: '2026-11-12',
        visitType: 'WIRE_CHANGE',
        status: 'COMPLETED',
        wires: [{ arch: 'UPPER', wireType: 'NITI', wireSize: '0.016', action: 'CHANGED' }],
        proceduresPerformed: ['Wire adjustment'],
      }).success
    ).toBe(true)
    expect(
      bracesVisitSchema.safeParse({ visitDate: '2026-11-12', visitType: 'REVIEW' }).success
    ).toBe(true)
  })

  it('shows the billing summary from the central billing module in the case GET', async () => {
    vi.mocked(prisma.bracesCase.findUnique).mockResolvedValue({
      id: 'c1',
      visits: [],
      assessments: [],
      media: [],
      retentionChecks: [],
    } as any)
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      { totalAmount: '1000', paidAmount: '400', balanceAmount: '600' },
      { totalAmount: '500', paidAmount: '500', balanceAmount: '0' },
    ] as any)
    const res = await GET(req('GET'), ctx)
    expect((await res.json()).billing).toEqual({ total: 1500, paid: 900, balance: 600 })
  })

  it("uses the clinic's local calendar date, not UTC", async () => {
    const { localToday } = await import('@/lib/braces/schema')
    expect(localToday(new Date(2026, 10, 13, 0, 30))).toBe('2026-11-13')
    expect(localToday(new Date(2026, 10, 12, 23, 59))).toBe('2026-11-12')
  })
})
