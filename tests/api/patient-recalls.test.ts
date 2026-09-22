import { beforeEach, describe, expect, it, vi } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({ requireAuthAndRole: vi.fn() }))
const mockSms = vi.hoisted(() => ({ sendSMS: vi.fn() }))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('@/lib/services/sms.service', () => ({ smsService: mockSms }))

const recallsModule = await import('@/app/api/patients/[id]/recalls/route')
const recallDetailModule = await import('@/app/api/patients/[id]/recalls/[recallId]/route')
const recallCronModule = await import('@/app/api/cron/recall/route')

const patientContext = { params: Promise.resolve({ id: 'patient-1' }) }
const recallContext = {
  params: Promise.resolve({ id: 'patient-1', recallId: 'recall-1' }),
}

function request(method: string, body?: unknown) {
  return new Request('http://localhost/api/patients/patient-1/recalls', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }) as any
}

describe('patient recall API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'reception-1', role: 'RECEPTIONIST' } },
    })
  })

  it('schedules six months after treatment with a seven-day reminder', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'patient-1' } as any)
    vi.mocked(prisma.treatment.findFirst).mockResolvedValue({
      id: 'treatment-1',
      endTime: new Date('2026-01-01T09:00:00.000Z'),
    } as any)
    vi.mocked(prisma.patientRecall.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.patientRecall.create).mockImplementation(async ({ data }: any) => ({
      id: 'recall-1',
      ...data,
    }))

    const response = await recallsModule.POST(request('POST', {}), patientContext)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(new Date(body.recall.followUpDate).toISOString()).toBe('2026-07-01T09:00:00.000Z')
    expect(new Date(body.recall.reminderDate).toISOString()).toBe('2026-06-24T09:00:00.000Z')
    expect(prisma.patientRecall.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdById: 'reception-1',
        reminderLeadDays: 7,
        treatmentId: 'treatment-1',
      }),
    })
  })

  it('requires a completed treatment', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'patient-1' } as any)
    vi.mocked(prisma.treatment.findFirst).mockResolvedValue(null)

    const response = await recallsModule.POST(request('POST', {}), patientContext)

    expect(response.status).toBe(400)
    expect(prisma.patientRecall.create).not.toHaveBeenCalled()
  })

  it('rejects a duplicate follow-up date', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'patient-1' } as any)
    vi.mocked(prisma.treatment.findFirst).mockResolvedValue({
      id: 'treatment-1',
      endTime: new Date('2026-01-01T09:00:00.000Z'),
    } as any)
    vi.mocked(prisma.patientRecall.findFirst).mockResolvedValue({ id: 'existing' } as any)

    const response = await recallsModule.POST(request('POST', {}), patientContext)

    expect(response.status).toBe(409)
  })

  it('marks that the patient returned', async () => {
    vi.mocked(prisma.patientRecall.findFirst).mockResolvedValue({
      id: 'recall-1',
      status: 'REMINDER_SENT',
    } as any)
    vi.mocked(prisma.patientRecall.update).mockResolvedValue({
      id: 'recall-1',
      status: 'RETURNED',
    } as any)

    const response = await recallDetailModule.PATCH(
      request('PATCH', { status: 'RETURNED' }),
      recallContext
    )

    expect(response.status).toBe(200)
    expect(prisma.patientRecall.update).toHaveBeenCalledWith({
      where: { id: 'recall-1' },
      data: expect.objectContaining({ status: 'RETURNED', returnedAt: expect.any(Date) }),
    })
  })
})

describe('recall reminder cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-cron-secret'
    vi.mocked(prisma.hospital.findMany).mockResolvedValue([])
  })

  it('claims and sends a due reminder once', async () => {
    const now = new Date()
    vi.mocked(prisma.patientRecall.updateMany)
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
    vi.mocked(prisma.patientRecall.findMany).mockResolvedValue([
      {
        id: 'recall-1',
        hospitalId: 'hospital-1',
        patientId: 'patient-1',
        followUpDate: new Date(now.getTime() + 7 * 86400000),
        reminderDate: now,
        smsStatus: 'PENDING',
        smsAttempts: 0,
        patient: { firstName: 'Marta', lastName: 'Tesfaye', phone: '+251911000000' },
        hospital: {
          name: 'Sunny Smile',
          phone: '+251111000000',
          timezone: 'Africa/Addis_Ababa',
        },
      },
    ] as any)
    mockSms.sendSMS.mockResolvedValue('sms-log-1')
    vi.mocked(prisma.patientRecall.update).mockResolvedValue({} as any)

    const response = await recallCronModule.GET(
      new Request('http://localhost/api/cron/recall', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.recallReminders).toEqual({ due: 1, sent: 1, failed: 0, skipped: 0 })
    expect(mockSms.sendSMS).toHaveBeenCalledWith(
      expect.objectContaining({
        hospitalId: 'hospital-1',
        patientId: 'patient-1',
        phone: '+251911000000',
        timezone: 'Africa/Addis_Ababa',
      })
    )
    expect(prisma.patientRecall.update).toHaveBeenCalledWith({
      where: { id: 'recall-1' },
      data: expect.objectContaining({
        status: 'REMINDER_SENT',
        smsStatus: 'SENT',
        smsLogId: 'sms-log-1',
      }),
    })
  })

  it('does not send when another cron invocation won the claim', async () => {
    vi.mocked(prisma.patientRecall.updateMany).mockResolvedValue({ count: 0 })
    vi.mocked(prisma.patientRecall.findMany).mockResolvedValue([
      {
        id: 'recall-1',
        hospitalId: 'hospital-1',
        patientId: 'patient-1',
        followUpDate: new Date(Date.now() + 86400000),
        reminderDate: new Date(),
        smsStatus: 'PENDING',
        smsAttempts: 0,
        patient: { firstName: 'Marta', lastName: 'Tesfaye', phone: '+251911000000' },
        hospital: { name: 'Sunny Smile', phone: null, timezone: 'Africa/Addis_Ababa' },
      },
    ] as any)

    const response = await recallCronModule.GET(
      new Request('http://localhost/api/cron/recall', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      })
    )
    const body = await response.json()

    expect(body.recallReminders.skipped).toBe(1)
    expect(mockSms.sendSMS).not.toHaveBeenCalled()
  })
})
