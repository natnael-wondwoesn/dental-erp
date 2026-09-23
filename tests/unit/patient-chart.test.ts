import { describe, expect, it } from 'vitest'

import {
  generateClinicalSummary,
  renderPatientChartHtml,
  type PatientChartData,
} from '@/lib/clinical-forms/patient-chart'

const base: Omit<PatientChartData, 'clinicalSummary'> = {
  chartNo: 'DC-2026-00001',
  visitDate: '2026-09-23',
  patient: { fullName: 'Abebe Kebede', patientId: 'PAT-1', age: '34', sex: 'MALE' },
  clinicianName: 'Dr Selam Abebe',
  chiefComplaint: 'Cold-sensitive pain on lower left tooth.',
  historyPresentIllness: 'Pain started three weeks ago.',
  pastMedicalHistory: 'Hypertension.',
  medicalAlerts: 'Penicillin allergy.',
  pastDentalHistory: 'Composite fillings.',
  socialFamilyHistory: 'Non-smoker.',
  bloodPressure: '128/82 mmHg',
  heartRate: '74 bpm',
  temperature: '36.9 C',
  extraOralExam: 'Normal.',
  intraOralExam: 'Deep caries on tooth 36.',
  radiographNotes: 'Decay approaches pulp.',
  diagnosis: 'Symptomatic irreversible pulpitis.',
  treatmentPlan: 'Phase 1: Root canal therapy.',
  estimatedCost: 'ETB 12,500',
  completedProcedures: 'Initial root canal completed.',
  materialsAnesthesia: '2% Mepivacaine.',
  postOpInstructions: 'Do not chew on treated side.',
  nextVisit: 'Seven days.',
  patientConsentName: 'Abebe Kebede',
}

describe('patient clinical chart', () => {
  it('generates complete SOAP narrative from visit data', () => {
    const summary = generateClinicalSummary(base)
    expect(summary).toContain('S: Chief complaint: Cold-sensitive pain')
    expect(summary).toContain('O: BP 128/82 mmHg')
    expect(summary).toContain('A: Symptomatic irreversible pulpitis.')
    expect(summary).toContain('P: Phase 1: Root canal therapy.')
  })

  it('renders medical alert, clinical sections, consent and signature', () => {
    const html = renderPatientChartHtml(
      { ...base, clinicalSummary: generateClinicalSummary(base) },
      { name: 'D/R Lemlem Special Dental Clinic' },
      'data:image/png;base64,signature'
    )
    expect(html).toContain('MEDICAL ALERTS:')
    expect(html).toContain('Penicillin allergy')
    expect(html).toContain('Dental Patient Chart')
    expect(html).toContain('Automated Clinical Note Summary')
    expect(html).toContain('data:image/png;base64,signature')
  })

  it('escapes clinical content in printable HTML', () => {
    const html = renderPatientChartHtml(
      { ...base, chiefComplaint: '<script>alert(1)</script>', clinicalSummary: 'Safe' },
      { name: 'D/R Lemlem Special Dental Clinic' }
    )
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})
