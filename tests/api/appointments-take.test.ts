import { beforeEach, describe, expect, it, vi } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const takeModule = await import('@/app/api/appointments/[id]/take/route')

function request() {
  return new Request('http://localhost/api/appointments/apt-1/take', {
    method: 'POST',
  }) as any
}

function context() {
  return { params: Promise.resolve({ id: 'apt-1' }) }
}

describe('POST /api/appointments/[id]/take', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: {
        user: {
          id: 'user-doctor-1',
          role: 'DOCTOR',
          staffId: 'doctor-1',
        },
      },
    })
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({ id: 'doctor-1' } as any)
  })

  it('atomically assigns the first doctor and records assignment time', async () => {
    vi.mocked(prisma.appointment.updateMany).mockResolvedValue({ count: 1 })
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      id: 'apt-1',
      status: 'IN_PROGRESS',
      doctorId: 'doctor-1',
      assignedAt: new Date(),
      patient: { id: 'patient-1' },
      doctor: { id: 'doctor-1' },
    } as any)

    const response = await takeModule.POST(request(), context())

    expect(response.status).toBe(200)
    expect(mockAuth.requireAuthAndRole).toHaveBeenCalledWith(['DOCTOR'])
    expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'apt-1',
        hospitalId: 'hospital-1',
        status: 'CHECKED_IN',
        assignedAt: null,
      },
      data: {
        doctorId: 'doctor-1',
        assignedAt: expect.any(Date),
        status: 'IN_PROGRESS',
      },
    })
  })

  it('returns conflict when another doctor already won the claim', async () => {
    vi.mocked(prisma.appointment.updateMany).mockResolvedValue({ count: 0 })
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      status: 'IN_PROGRESS',
      assignedAt: new Date(),
    } as any)

    const response = await takeModule.POST(request(), context())
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toContain('already been taken')
  })

  it('rejects a doctor account without a linked staff record', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-doctor-1', role: 'DOCTOR' } },
    })

    const response = await takeModule.POST(request(), context())

    expect(response.status).toBe(403)
    expect(prisma.appointment.updateMany).not.toHaveBeenCalled()
  })

  it('returns not found when the appointment does not exist', async () => {
    vi.mocked(prisma.appointment.updateMany).mockResolvedValue({ count: 0 })
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)

    const response = await takeModule.POST(request(), context())

    expect(response.status).toBe(404)
  })
})
