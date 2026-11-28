import { describe, expect, it } from 'vitest'
import { diffPatientCorrection } from '@/lib/patient-correction'

describe('diffPatientCorrection', () => {
  const existing = {
    firstName: 'Abel',
    lastName: 'Kebede',
    phone: '0911000001',
    email: null,
    dateOfBirth: new Date('1990-05-01T00:00:00Z'),
  }

  it('returns previous and updated values only for fields that changed', () => {
    const { oldValues, newValues } = diffPatientCorrection(existing, {
      firstName: 'Abel',
      lastName: 'Kebedee',
      phone: '0911000002',
    })
    expect(oldValues).toEqual({ lastName: 'Kebede', phone: '0911000001' })
    expect(newValues).toEqual({ lastName: 'Kebedee', phone: '0911000002' })
  })

  it('treats empty strings and null as the same and compares dates by day', () => {
    const { newValues } = diffPatientCorrection(existing, {
      email: '',
      dateOfBirth: '1990-05-01',
    })
    expect(newValues).toEqual({})
  })

  it('ignores fields that were not submitted and non-correctable fields', () => {
    expect(diffPatientCorrection(existing, { aiSummary: 'x', id: 'y' })).toEqual({
      oldValues: {},
      newValues: {},
    })
  })
})
