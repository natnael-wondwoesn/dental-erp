import { expect, test } from '@playwright/test'

import { renderMedicalCertificateHtml } from '../../lib/clinical-forms/medical-certificate'
import { renderPrescriptionPaperHtml } from '../../lib/clinical-forms/prescription-paper'

const clinic = {
  name: 'Sunny Smile Speciality Cinic',
  address: 'Bole Road, near Edna Mall',
  city: 'Addis Ababa',
  phone: '0116672211',
  email: 'hello@sunnysmile.et',
}

function pdfPageCount(pdf: Buffer) {
  return pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 0
}

test('medical certificate prints on exactly one A4 page', async ({ page }) => {
  await page.setContent(
    renderMedicalCertificateHtml(
      {
        certificateNo: 'MC-2026-0001',
        patientId: 'patient-1',
        patientFullName: 'Natnael Test',
        cardNo: 'PAT202600001',
        sex: 'MALE',
        age: '30',
        city: 'Addis Ababa',
        subCity: 'Kirkos',
        woreda: '04',
        examinedAt: '2026-08-20',
        dentalDiagnosis: 'Root canal treatment and management of acute dental pain.',
        medicalDiagnosis: 'No additional systemic diagnosis recorded.',
        recommendation: 'Rest for seven days, take medication as prescribed and return for review.',
        leaveFrom: '2026-08-21',
        leaveTo: '2026-08-28',
        physicianName: 'Dr Selam Abebe',
        physicianQualification: 'Dental Surgeon',
        physicianRegistration: 'AA-DEN-014',
      },
      clinic
    )
  )

  const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
  expect(pdfPageCount(pdf)).toBe(1)
})

test('prescription paper prints on exactly one A4 page', async ({ page }) => {
  await page.setContent(
    renderPrescriptionPaperHtml(
      {
        prescriptionNo: 'RX20260001',
        createdAt: '2026-08-20T08:00:00.000Z',
        patient: {
          fullName: 'Natnael Test',
          patientId: 'PAT202600001',
          sex: 'MALE',
          age: '30',
          phone: '0911234567',
          address: 'Bole Road, Addis Ababa',
        },
        diagnosis: 'Acute apical abscess associated with the lower right first molar.',
        medications: Array.from({ length: 7 }, (_, index) => ({
          name: `Medication ${index + 1} 500 mg capsule`,
          dosage: '500 mg',
          frequency: 'Every 8 hours',
          duration: '5 days',
          quantity: '15',
          instructions: 'Take after food and complete the prescribed course.',
        })),
        notes: 'Return immediately for swelling, breathing difficulty or rash.',
        prescriber: {
          name: 'Dr Selam Abebe',
          qualification: 'Dental Surgeon',
          registration: 'AA-DEN-014',
        },
      },
      clinic
    )
  )

  const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
  expect(pdfPageCount(pdf)).toBe(1)
})
