import { describe, expect, it } from 'vitest'
import {
  normalizeTreatmentClinicalSheet,
  parseTreatmentClinicalSheet,
  serializeTreatmentClinicalSheet,
} from '@/lib/treatment-clinical-sheet'

describe('treatment clinical sheet', () => {
  it('normalizes and round-trips the paper fields', () => {
    const serialized = serializeTreatmentClinicalSheet({
      treatmentDate: '2026-10-28',
      temperatureC: 36.8,
      bloodPressure: '120/80',
      spo2: 98,
      pulseRate: 72,
      historyPresentIllness: 'Pain for two days',
      assessment: 'Dental caries',
      nextAppointment: '2026-11-04',
      doctorSignature: 'Dr. Berhanu Belta',
    })

    expect(parseTreatmentClinicalSheet(serialized)).toMatchObject({
      treatmentDate: '2026-10-28',
      temperatureC: '36.8',
      bloodPressure: '120/80',
      spo2: '98',
      pulseRate: '72',
      historyPresentIllness: 'Pain for two days',
      assessment: 'Dental caries',
      nextAppointment: '2026-11-04',
      doctorSignature: 'Dr. Berhanu Belta',
    })
  })

  it('rejects malformed input and invalid dates', () => {
    expect(normalizeTreatmentClinicalSheet(null)).toBeNull()
    expect(normalizeTreatmentClinicalSheet([])).toBeNull()
    expect(normalizeTreatmentClinicalSheet({ treatmentDate: 'tomorrow' })).toBeNull()
  })
})
