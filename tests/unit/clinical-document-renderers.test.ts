import { describe, expect, it } from 'vitest'

import { renderMedicalCertificateHtml } from '@/lib/clinical-forms/medical-certificate'
import { renderPrescriptionPaperHtml } from '@/lib/clinical-forms/prescription-paper'

const clinic = {
  name: 'D/R Lemlem Special Dental Clinic',
  city: 'Addis Ababa',
  phone: '+251911234567',
}

describe('clinical document renderers', () => {
  it('never renders legacy Dentix branding from stored clinic data', () => {
    const html = renderMedicalCertificateHtml(
      {
        certificateNo: 'MC-2026-0001',
        patientId: 'patient-1',
        patientFullName: 'Abebe Kebede',
        cardNo: 'PAT202600001',
        examinedAt: '2026-08-20',
        dentalDiagnosis: 'Acute apical abscess',
        recommendation: 'Rest and return for review.',
        physicianName: 'Dr Selam Abebe',
      },
      { ...clinic, name: 'Sunny Smile Speciality Cinic' }
    )

    expect(html).not.toMatch(/dentix/i)
    expect(html).toContain('D/R Lemlem Special Dental Clinic')
  })

  it('renders a printable medical certificate with leave dates and doctor details', () => {
    const html = renderMedicalCertificateHtml(
      {
        certificateNo: 'MC-2026-0001',
        patientId: 'patient-1',
        patientFullName: 'Abebe Kebede',
        cardNo: 'PAT202600001',
        examinedAt: '2026-08-20',
        dentalDiagnosis: 'Acute apical abscess',
        recommendation: 'Rest and return for review.',
        leaveFrom: '2026-08-20',
        leaveTo: '2026-08-22',
        physicianName: 'Dr Selam Abebe',
      },
      clinic
    )

    expect(html).toContain('D/R Lemlem Special Dental Clinic')
    expect(html).toContain('Medical Certificate')
    expect(html).toContain('MC-2026-0001')
    expect(html).toContain('Rest Recommendation')
    expect(html).toContain('Fit for work')
    expect(html).toContain('Dr Selam Abebe')
    expect(html).toContain('@page{size:A5 portrait')
  })

  it('renders the supplied prescription-paper structure and medication grid', () => {
    const html = renderPrescriptionPaperHtml(
      {
        prescriptionNo: 'RX20260001',
        createdAt: '2026-08-20T08:00:00.000Z',
        patient: { fullName: 'Abebe Kebede', patientId: 'PAT1', age: '32', sex: 'MALE' },
        diagnosis: 'Post-extraction pain',
        medications: [
          {
            name: 'Amoxicillin 500 mg capsule',
            dosage: '500 mg',
            frequency: 'TID',
            duration: '5 days',
            quantity: '15',
          },
        ],
        prescriber: { name: 'Dr Selam Abebe', registration: 'DDS-123' },
      },
      clinic
    )

    expect(html).toContain('Prescription Paper')
    expect(html).toContain('Treatment given&nbsp; (Drug Name, Strength,')
    expect(html).toContain('Price of each item')
    expect(html).toContain('Amoxicillin 500 mg capsule')
    expect(html).toContain('Prescriber’s')
    expect(html).toContain('Dispenser’s')
  })

  it('escapes clinical values before inserting them into document HTML', () => {
    const html = renderMedicalCertificateHtml(
      {
        certificateNo: 'MC-1',
        patientId: 'patient-1',
        patientFullName: '<script>alert(1)</script>',
        cardNo: 'PAT1',
        examinedAt: '2026-08-20',
        dentalDiagnosis: 'Pain & swelling',
        recommendation: 'Rest',
        physicianName: 'Doctor',
      },
      clinic
    )

    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('Pain &amp; swelling')
  })
})
