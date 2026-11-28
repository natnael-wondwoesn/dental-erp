import { describe, expect, it } from 'vitest'
import { isBtfanaClinicName } from '@/lib/clinic-flags'

describe('isBtfanaClinicName', () => {
  it('matches only btFana', () => {
    expect(isBtfanaClinicName('btFana Speciality Dental Clinic')).toBe(true)
    expect(isBtfanaClinicName('Dr Berhanu Belta Specialty Dental Clinic')).toBe(false)
    expect(isBtfanaClinicName(undefined)).toBe(false)
  })
})
