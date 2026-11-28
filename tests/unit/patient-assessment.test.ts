// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { ASSESSMENT_MAX_LENGTH, parseAssessmentInput } from '@/lib/patient-assessment'

const mocks = vi.hoisted(() => ({
  prisma: {
    patient: { findFirst: vi.fn() },
    staff: { findFirst: vi.fn() },
    patientAssessment: { findMany: vi.fn(), create: vi.fn() },
  },
  requireAuthAndRole: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/lib/api-helpers', () => ({ requireAuthAndRole: mocks.requireAuthAndRole }))

import { GET, POST } from '@/app/api/patients/[id]/assessments/route'

const ctx = { params: Promise.resolve({ id: 'p1' }) }
const post = (body: unknown) =>
  POST(
    new NextRequest('https://clinic.test/api/patients/p1/assessments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    ctx
  )
const signedIn = (staffId: string | null = 's1') =>
  mocks.requireAuthAndRole.mockResolvedValue({
    error: null,
    hospitalId: 'h1',
    session: { user: { id: 'u1', staffId } },
  })

describe('parseAssessmentInput', () => {
  it('trims and keeps empty boxes as null', () => {
    expect(parseAssessmentInput({ vitalSigns: '  BP 120/80 ', others: '' })).toEqual({
      ok: true,
      value: { vitalSigns: 'BP 120/80', others: null },
    })
  })
  it('rejects when both boxes are empty', () => {
    expect(parseAssessmentInput({ vitalSigns: ' ', others: '' }).ok).toBe(false)
    expect(parseAssessmentInput(null).ok).toBe(false)
  })
  it('rejects overly long text', () => {
    const long = 'x'.repeat(ASSESSMENT_MAX_LENGTH + 1)
    expect(parseAssessmentInput({ others: long }).ok).toBe(false)
  })
})

describe('assessments API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.patient.findFirst.mockResolvedValue({ id: 'p1', hospitalId: 'h1' })
    mocks.prisma.staff.findFirst.mockResolvedValue({ id: 's1', hospitalId: 'h1' })
    mocks.prisma.patientAssessment.create.mockImplementation(async ({ data }) => ({
      id: 'a1',
      ...data,
    }))
  })

  it('creates a NEW record for the existing patient with the signed-in doctor', async () => {
    signedIn()
    const res = await post({ vitalSigns: 'BP 120/80', others: 'Caries on 36' })
    expect(res.status).toBe(201)
    expect(mocks.prisma.patientAssessment.create.mock.calls[0][0].data).toEqual({
      hospitalId: 'h1',
      patientId: 'p1',
      doctorId: 's1',
      vitalSigns: 'BP 120/80',
      others: 'Caries on 36',
    })
    await post({ others: 'Follow-up' })
    expect(mocks.prisma.patientAssessment.create).toHaveBeenCalledTimes(2)
  })

  it('rejects an empty submission and an account without a staff record', async () => {
    signedIn()
    expect((await post({ vitalSigns: '', others: '' })).status).toBe(400)
    signedIn(null)
    expect((await post({ others: 'x' })).status).toBe(403)
    expect(mocks.prisma.patientAssessment.create).not.toHaveBeenCalled()
  })

  it('returns 404 for a patient from another clinic', async () => {
    signedIn()
    mocks.prisma.patient.findFirst.mockResolvedValue(null)
    expect((await post({ others: 'x' })).status).toBe(404)
  })

  it('lists history newest first for the clinic', async () => {
    signedIn()
    mocks.prisma.patientAssessment.findMany.mockResolvedValue([{ id: 'a2' }, { id: 'a1' }])
    const res = await GET(new NextRequest('https://clinic.test/api/patients/p1/assessments'), ctx)
    expect((await res.json()).assessments).toHaveLength(2)
    expect(mocks.prisma.patientAssessment.findMany.mock.calls[0][0]).toMatchObject({
      where: { hospitalId: 'h1', patientId: 'p1' },
      orderBy: { createdAt: 'desc' },
    })
  })
})
