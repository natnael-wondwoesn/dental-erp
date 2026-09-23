import { beforeEach, describe, expect, it, vi } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const auth = vi.hoisted(() => ({ requireAuthAndRole: vi.fn() }))
vi.mock('@/lib/api-helpers', () => auth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const route = await import('@/app/api/patients/[id]/clinical-chart/route')
const context = { params: Promise.resolve({ id: 'patient-1' }) }

function request(method: string, body?: unknown) {
  return new Request('http://localhost/api/patients/patient-1/clinical-chart', {
    method,
    ...(body
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  }) as any
}

const patient = {
  id: 'patient-1',
  patientId: 'PAT-1',
  firstName: 'Abebe',
  lastName: 'Kebede',
  age: 34,
  dateOfBirth: null,
  gender: 'MALE',
  medicalHistory: { hasAllergies: true, drugAllergies: 'Penicillin' },
  dentalChart: [],
  documents: [],
}

describe('patient clinical chart API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      user: { id: 'user-1', name: 'Dr Selam' },
      session: { user: { role: 'DOCTOR', name: 'Dr Selam' } },
    })
  })

  it('returns patient safety context and saved charts', async () => {
    ;(prisma.patient.findFirst as any).mockResolvedValue(patient)
    ;(prisma.formTemplate.findFirst as any).mockResolvedValue({ id: 'template-1' })
    ;(prisma.formSubmission.findMany as any).mockResolvedValue([])
    const response = await route.GET(request('GET'), context)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.patient.medicalAlerts).toContain('Penicillin')
    expect(body.patient.patientId).toBe('PAT-1')
  })

  it('saves immutable approved encounter with generated summary', async () => {
    ;(prisma.patient.findFirst as any).mockResolvedValue(patient)
    ;(prisma.staff.findFirst as any).mockResolvedValue({ firstName: 'Selam', lastName: 'Abebe' })
    ;(prisma.formTemplate.findFirst as any).mockResolvedValue({ id: 'template-1' })
    ;(prisma.formSubmission.count as any).mockResolvedValue(0)
    ;(prisma.formSubmission.create as any).mockImplementation(({ data }: any) => ({
      id: 'chart-1',
      data: data.data,
    }))
    const response = await route.POST(
      request('POST', {
        visitDate: '2026-09-23',
        chiefComplaint: 'Cold-sensitive lower tooth.',
        diagnosis: 'Symptomatic irreversible pulpitis.',
        treatmentPlan: 'Phase 1: Root canal therapy.',
      }),
      context
    )
    expect(response.status).toBe(201)
    const create = (prisma.formSubmission.create as any).mock.calls[0][0].data
    expect(create.status).toBe('APPROVED')
    expect(create.data.chartNo).toBe('DC-2026-00001')
    expect(create.data.clinicalSummary).toContain('A: Symptomatic irreversible pulpitis.')
  })

  it('rejects chart without required diagnosis', async () => {
    const response = await route.POST(
      request('POST', { visitDate: '2026-09-23', chiefComplaint: 'Pain' }),
      context
    )
    expect(response.status).toBe(400)
  })
})
