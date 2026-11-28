import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma, resetPrismaMocks } from '../__mocks__/prisma'

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))
const auth = vi.hoisted(() => ({ requireAuthAndRole: vi.fn() }))
vi.mock('@/lib/api-helpers', () => auth)

import { PUT } from '@/app/api/patients/[id]/route'

const existing = {
  id: 'p1',
  hospitalId: 'h1',
  firstName: 'Abel',
  lastName: 'Kebede',
  phone: '0911',
}
const call = (body: Record<string, unknown>) =>
  PUT(
    new NextRequest('https://clinic.test/api/patients/p1', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'user-agent': 'vitest' },
    }),
    { params: Promise.resolve({ id: 'p1' }) }
  )
const as = (role: string) =>
  auth.requireAuthAndRole.mockResolvedValue({
    error: null,
    hospitalId: 'h1',
    user: { id: 'u1', role },
  })

describe('PUT /api/patients/[id]', () => {
  beforeEach(() => {
    resetPrismaMocks()
    prisma.patient.findFirst.mockResolvedValue(existing)
    prisma.patient.update.mockResolvedValue({ ...existing, lastName: 'Kebedee' })
  })

  it('blocks non-admin edits at btFana', async () => {
    prisma.hospital.findUnique.mockResolvedValue({ name: 'btFana Speciality Dental Clinic' })
    as('RECEPTIONIST')
    const res = await call({ lastName: 'Kebedee' })
    expect(res.status).toBe(403)
    expect(prisma.patient.update).not.toHaveBeenCalled()
  })

  it('lets an administrator correct and audits previous and updated values', async () => {
    prisma.hospital.findUnique.mockResolvedValue({ name: 'btFana Speciality Dental Clinic' })
    as('ADMIN')
    const res = await call({ firstName: 'Abel', lastName: 'Kebedee' })
    expect(res.status).toBe(200)
    const data = prisma.auditLog.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      hospitalId: 'h1',
      userId: 'u1',
      action: 'PATIENT_CORRECTION',
      entityType: 'Patient',
      entityId: 'p1',
    })
    expect(JSON.parse(data.oldValues)).toEqual({ lastName: 'Kebede' })
    expect(JSON.parse(data.newValues)).toEqual({ lastName: 'Kebedee' })
  })

  it('does not change behaviour for other clinics', async () => {
    prisma.hospital.findUnique.mockResolvedValue({ name: 'Abiy Dental Clinic' })
    as('RECEPTIONIST')
    const res = await call({ lastName: 'Kebedee' })
    expect(res.status).toBe(200)
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })
})
