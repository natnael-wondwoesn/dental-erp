// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))
vi.mock('@/lib/api-helpers', () => ({ requireAuthAndRole: vi.fn() }))
vi.mock('@/lib/braces/audit', () => ({ bracesAudit: vi.fn() }))

import { POST } from '@/app/api/patients/[id]/braces/assessments/route'
import { PUT } from '@/app/api/patients/[id]/braces/assessments/[assessmentId]/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

const req = (method: string, body: unknown) =>
  new NextRequest('http://localhost/api/patients/p1/braces/assessments', {
    method,
    body: JSON.stringify(body),
  })
const post = { params: Promise.resolve({ id: 'p1' }) }
const put = (assessmentId = 'a1') => ({ params: Promise.resolve({ id: 'p1', assessmentId }) })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuthAndRole).mockResolvedValue({
    error: null,
    hospitalId: 'h1',
    user: { id: 'u1' },
  } as any)
  vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as any)
  vi.mocked(prisma.bracesCase.upsert).mockResolvedValue({ id: 'c1' } as any)
  vi.mocked(prisma.bracesAssessment.create).mockResolvedValue({ id: 'a1' } as any)
  vi.mocked(prisma.medicalHistory.findUnique).mockResolvedValue(null)
})

describe('POST assessment with sex, conditions and chart', () => {
  it('saves them and adds the conditions to the patient medical history', async () => {
    const res = await POST(
      req('POST', {
        assessedAt: '2026-11-26',
        sex: 'MALE',
        medicalConditions: ['DIABETES_1', 'KIDNEY'],
        palmerChart: { texts: [{ id: 't', x: 10, y: 10, text: 'UR6 caries' }], strokes: [] },
      }),
      post
    )
    expect(res.status).toBe(201)
    const data = vi.mocked(prisma.bracesAssessment.create).mock.calls[0][0].data
    expect(data).toMatchObject({ sex: 'MALE', medicalConditions: ['DIABETES_1', 'KIDNEY'] })
    expect(data.palmerChart.texts[0].text).toBe('UR6 caries')
    const upsert = vi.mocked(prisma.medicalHistory.upsert).mock.calls[0][0]
    expect(upsert.where).toEqual({ patientId: 'p1' })
    expect(upsert.update).toMatchObject({
      hasDiabetes: true,
      diabetesType: 'Type 1',
      otherConditions: 'Kidney problems',
    })
  })

  it('leaves the patient medical history alone for "None"', async () => {
    await POST(req('POST', { assessedAt: '2026-11-26', medicalConditions: ['NONE'] }), post)
    expect(prisma.medicalHistory.upsert).not.toHaveBeenCalled()
  })

  it('rejects "None" combined with a condition', async () => {
    const res = await POST(
      req('POST', { assessedAt: '2026-11-26', medicalConditions: ['NONE', 'HIV'] }),
      post
    )
    expect(res.status).toBe(400)
    expect(prisma.bracesAssessment.create).not.toHaveBeenCalled()
  })
})

describe('PUT assessment chart', () => {
  const chart = { texts: [{ id: 't', x: 50, y: 60, text: 'Moved note' }], strokes: [] }

  it('updates only the chart of an assessment that belongs to this patient and clinic', async () => {
    vi.mocked(prisma.bracesAssessment.findFirst).mockResolvedValue({ id: 'a1' } as any)
    vi.mocked(prisma.bracesAssessment.update).mockResolvedValue({ id: 'a1' } as any)
    const res = await PUT(req('PUT', { palmerChart: chart }), put())
    expect(res.status).toBe(200)
    expect(prisma.bracesAssessment.findFirst).toHaveBeenCalledWith({
      where: { id: 'a1', hospitalId: 'h1', bracesCase: { patientId: 'p1' } },
    })
    const args = vi.mocked(prisma.bracesAssessment.update).mock.calls[0][0]
    expect(Object.keys(args.data)).toEqual(['palmerChart'])
    expect(args.data.palmerChart.texts[0].text).toBe('Moved note')
  })

  it('404s for an assessment outside this patient or clinic', async () => {
    vi.mocked(prisma.bracesAssessment.findFirst).mockResolvedValue(null)
    const res = await PUT(req('PUT', { palmerChart: chart }), put('other'))
    expect(res.status).toBe(404)
    expect(prisma.bracesAssessment.update).not.toHaveBeenCalled()
  })

  it('clears the column when the chart is emptied, and rejects a malformed chart', async () => {
    vi.mocked(prisma.bracesAssessment.findFirst).mockResolvedValue({ id: 'a1' } as any)
    vi.mocked(prisma.bracesAssessment.update).mockResolvedValue({ id: 'a1' } as any)
    expect((await PUT(req('PUT', { palmerChart: null }), put())).status).toBe(200)
    expect(vi.mocked(prisma.bracesAssessment.update).mock.calls[0][0].data.palmerChart).toBeTruthy()
    expect(
      (
        await PUT(
          req('PUT', { palmerChart: { texts: [{ id: 't', x: 5000, y: 1, text: 'x' }] } }),
          put()
        )
      ).status
    ).toBe(400)
  })

  it('needs a doctor or admin', async () => {
    vi.mocked(requireAuthAndRole).mockResolvedValue({
      error: new Response(null, { status: 403 }),
    } as any)
    expect((await PUT(req('PUT', { palmerChart: chart }), put())).status).toBe(403)
  })
})
