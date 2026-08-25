// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as publicDoctorsGET } from '@/app/api/public/[slug]/doctors/route'
import { POST as publicBookPOST } from '@/app/api/public/[slug]/book/route'
import { prisma } from '@/lib/prisma'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(path: string, method = 'GET', body?: any): NextRequest {
  const url = `http://localhost${path}`
  const init: any = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(url, init)
}

function makeParams(slug: string) {
  return { params: Promise.resolve({ slug }) }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. GET /api/public/[slug]/doctors
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/public/[slug]/doctors', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when clinic not found', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue(null)

    const res = await publicDoctorsGET(
      makeReq('/api/public/nonexistent/doctors'),
      makeParams('nonexistent')
    )
    expect(res.status).toBe(404)
  })

  it('returns 403 when portal not enabled', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      id: 'h1',
      name: 'Test Clinic',
      patientPortalEnabled: false,
    } as any)

    const res = await publicDoctorsGET(
      makeReq('/api/public/test-clinic/doctors'),
      makeParams('test-clinic')
    )
    expect(res.status).toBe(403)
  })

  it('returns doctors list with hospital name', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      id: 'h1',
      name: 'Smile Dental',
      patientPortalEnabled: true,
    } as any)
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      { id: 'd1', firstName: 'Dr', lastName: 'Smith', specialization: 'General' },
      { id: 'd2', firstName: 'Dr', lastName: 'Jones', specialization: 'Ortho' },
    ] as any)

    const res = await publicDoctorsGET(
      makeReq('/api/public/smile-dental/doctors'),
      makeParams('smile-dental')
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.doctors).toHaveLength(2)
    expect(body.hospitalName).toBe('Smile Dental')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. POST /api/public/[slug]/book
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/public/[slug]/book', () => {
  beforeEach(() => vi.clearAllMocks())

  const validBooking = {
    firstName: 'Abel',
    lastName: 'Tesfaye',
    phone: '0911234567',
    doctorId: 'd1',
    date: '2099-03-15',
    time: '10:00',
  }

  it('returns 400 when required fields missing', async () => {
    const res = await publicBookPOST(
      makeReq('/api/public/test/book', 'POST', { phone: '9876543210' }),
      makeParams('test')
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when clinic not found', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue(null)

    const res = await publicBookPOST(
      makeReq('/api/public/nonexistent/book', 'POST', validBooking),
      makeParams('nonexistent')
    )
    expect(res.status).toBe(404)
  })

  it('returns 403 when portal not enabled', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      id: 'h1',
      patientPortalEnabled: false,
    } as any)

    const res = await publicBookPOST(
      makeReq('/api/public/test/book', 'POST', validBooking),
      makeParams('test')
    )
    expect(res.status).toBe(403)
  })

  it('creates a minimal patient record for a first-time visitor', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      id: 'h1',
      patientPortalEnabled: true,
      workingHours: null,
    } as any)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'd1',
      firstName: 'Selam',
      lastName: 'Abebe',
    } as any)
    vi.mocked(prisma.holiday.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.staffShift.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.patient.create).mockResolvedValue({
      id: 'p-new',
      firstName: 'Abel',
      lastName: 'Tesfaye',
    } as any)
    vi.mocked(prisma.appointment.create).mockResolvedValue({
      appointmentNo: 'APT-WEB-1',
      scheduledDate: new Date('2099-03-15'),
      scheduledTime: '10:00',
    } as any)

    const res = await publicBookPOST(
      makeReq('/api/public/test/book', 'POST', validBooking),
      makeParams('test')
    )
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.patientCreated).toBe(true)
    expect(prisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '+251911234567' }),
      })
    )
  })

  it('returns 404 when doctor not found', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      id: 'h1',
      patientPortalEnabled: true,
      workingHours: null,
    } as any)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'p1',
      firstName: 'John',
      lastName: 'Doe',
    } as any)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue(null)

    const res = await publicBookPOST(
      makeReq('/api/public/test/book', 'POST', { ...validBooking, doctorId: 'd-none' }),
      makeParams('test')
    )
    expect(res.status).toBe(404)
  })

  it('returns 409 when the doctor slot was already booked', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      id: 'h1',
      patientPortalEnabled: true,
      workingHours: null,
    } as any)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'p1',
      firstName: 'John',
      lastName: 'Doe',
    } as any)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'd1',
      firstName: 'Dr',
      lastName: 'Smith',
    } as any)
    vi.mocked(prisma.holiday.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.staffShift.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { patientId: 'p2', scheduledTime: '10:00', duration: 30 },
    ] as any)

    const res = await publicBookPOST(
      makeReq('/api/public/test/book', 'POST', validBooking),
      makeParams('test')
    )
    expect(res.status).toBe(409)
  })

  it('books appointment successfully', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      id: 'h1',
      patientPortalEnabled: true,
      workingHours: null,
    } as any)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'p1',
      firstName: 'John',
      lastName: 'Doe',
    } as any)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'd1',
      firstName: 'Dr',
      lastName: 'Smith',
    } as any)
    vi.mocked(prisma.holiday.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.staffShift.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.appointment.create).mockResolvedValue({
      appointmentNo: 'APT00100',
      scheduledDate: new Date('2099-03-15'),
      scheduledTime: '10:00',
    } as any)

    const res = await publicBookPOST(
      makeReq('/api/public/test/book', 'POST', { ...validBooking, chiefComplaint: 'Tooth pain' }),
      makeParams('test')
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.appointment.appointmentNo).toBe('APT00100')
    expect(body.appointment.doctor).toBe('Dr. Dr Smith')
  })
})
