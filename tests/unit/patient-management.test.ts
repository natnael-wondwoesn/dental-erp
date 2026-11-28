import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma, resetPrismaMocks } from '../__mocks__/prisma'

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))
vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn().mockResolvedValue({ error: null, hospitalId: 'h1', session: {} }),
}))

import {
  buildTodayVisits,
  summarizeVisits,
  decideWalkIn,
  appointmentStatusLabel,
  visitTypeLabel,
  toVisitStatus,
  clinicClockTime,
} from '@/lib/patient-management'
import { POST as walkIn } from '@/app/api/appointments/walk-in/route'

const patient = { patientId: 'P1', firstName: 'Abel', lastName: 'Kebede', phone: '0911' }
const mk = (status: string, checkedInAt: string | null, extra = {}) => ({
  status,
  checkedInAt,
  patient,
  doctorId: 'd1',
  ...extra,
})

describe('patient-management helpers', () => {
  it('excludes cancelled / no-show / scheduled from visits and counts', () => {
    const list = [
      mk('CHECKED_IN', '2026-11-28T09:00:00Z'),
      mk('IN_PROGRESS', '2026-11-28T08:00:00Z'),
      mk('COMPLETED', '2026-11-28T07:00:00Z'),
      mk('CANCELLED', null),
      mk('NO_SHOW', null),
      mk('SCHEDULED', null),
    ]
    const visits = buildTodayVisits(list)
    expect(visits).toHaveLength(3)
    expect(visits.map((v) => v.status)).toEqual(['COMPLETED', 'IN_PROGRESS', 'CHECKED_IN'])
    expect(summarizeVisits(list)).toEqual({ total: 3, waiting: 1, inProgress: 1, completed: 1 })
  })

  it('filters by search and doctor', () => {
    const list = [
      mk('CHECKED_IN', '2026-11-28T09:00:00Z'),
      mk('CHECKED_IN', '2026-11-28T09:30:00Z', { doctorId: 'd2' }),
    ]
    expect(buildTodayVisits(list, { search: 'p1' })).toHaveLength(2)
    expect(buildTodayVisits(list, { search: 'zzz' })).toHaveLength(0)
    expect(buildTodayVisits(list, { doctorId: 'd2' })).toHaveLength(1)
    expect(buildTodayVisits(list, { doctorId: 'all' })).toHaveLength(2)
  })

  it('labels', () => {
    expect(appointmentStatusLabel('SCHEDULED')).toBe('Pending')
    expect(appointmentStatusLabel('CHECKED_IN')).toBe('Arrived')
    expect(appointmentStatusLabel('NO_SHOW')).toBe('No-show')
    expect(visitTypeLabel('FOLLOW_UP')).toBe('Follow-up')
    expect(visitTypeLabel('CONSULTATION')).toBe('New')
    expect(toVisitStatus('CANCELLED')).toBeNull()
  })

  it('decideWalkIn prevents duplicates', () => {
    expect(decideWalkIn([])).toEqual({ action: 'create' })
    expect(decideWalkIn([{ id: 'a', status: 'CHECKED_IN' }])).toEqual({
      action: 'existing-active',
      appointmentId: 'a',
    })
    expect(
      decideWalkIn([
        { id: 'a', status: 'SCHEDULED' },
        { id: 'b', status: 'IN_PROGRESS' },
      ])
    ).toEqual({ action: 'existing-active', appointmentId: 'b' })
    expect(decideWalkIn([{ id: 'a', status: 'CONFIRMED' }])).toEqual({
      action: 'check-in-scheduled',
      appointmentId: 'a',
    })
  })
})

describe('walk-in route', () => {
  beforeEach(() => resetPrismaMocks())
  const call = (body: unknown) =>
    walkIn(
      new NextRequest('http://x/api/appointments/walk-in', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    )

  it('requires patient and doctor', async () => {
    expect((await call({ patientId: 'p1' })).status).toBe(400)
  })

  it('creates a CHECKED_IN visit for a patient with no active visit', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1' })
    prisma.staff.findFirst.mockResolvedValue({ id: 'd1' })
    prisma.appointment.findMany.mockResolvedValue([])
    prisma.appointment.findFirst.mockResolvedValue(null)
    prisma.appointment.create.mockResolvedValue({ id: 'new', status: 'CHECKED_IN' })
    const res = await call({ patientId: 'p1', doctorId: 'd1' })
    expect(res.status).toBe(201)
    const data = prisma.appointment.create.mock.calls[0][0].data
    expect(data.status).toBe('CHECKED_IN')
    expect(data.hospitalId).toBe('h1')
    expect(data.checkedInAt).toBeInstanceOf(Date)
  })

  it('refuses with 409 and the existing visit when already active today', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1' })
    prisma.staff.findFirst.mockResolvedValue({ id: 'd1' })
    prisma.appointment.findMany.mockResolvedValue([{ id: 'a1', status: 'CHECKED_IN' }])
    prisma.appointment.findFirst.mockResolvedValue({ id: 'a1', status: 'CHECKED_IN' })
    const res = await call({ patientId: 'p1', doctorId: 'd1' })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('ACTIVE_VISIT_EXISTS')
    expect(body.appointment.id).toBe('a1')
    expect(prisma.appointment.create).not.toHaveBeenCalled()
  })

  it('checks in the existing scheduled appointment instead of creating another', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1' })
    prisma.staff.findFirst.mockResolvedValue({ id: 'd1' })
    prisma.appointment.findMany.mockResolvedValue([{ id: 'a1', status: 'SCHEDULED' }])
    prisma.appointment.updateMany.mockResolvedValue({ count: 1 })
    prisma.appointment.findFirst.mockResolvedValue({ id: 'a1', status: 'CHECKED_IN' })
    const res = await call({ patientId: 'p1', doctorId: 'd1' })
    expect(res.status).toBe(200)
    expect(prisma.appointment.create).not.toHaveBeenCalled()
    expect(prisma.appointment.updateMany).toHaveBeenCalledTimes(1)
  })
})

describe('clinicClockTime', () => {
  it('renders the clinic wall-clock time, not UTC', () => {
    expect(clinicClockTime(new Date('2026-11-28T09:56:00Z'), 'Africa/Addis_Ababa')).toBe('12:56')
    expect(clinicClockTime(new Date('2026-11-28T21:05:00Z'))).toBe('00:05')
  })
  it('falls back to Addis Ababa for an invalid timezone', () => {
    expect(clinicClockTime(new Date('2026-11-28T09:56:00Z'), 'Not/AZone')).toBe('12:56')
  })
})
