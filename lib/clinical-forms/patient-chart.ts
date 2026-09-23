import { resolveClinicName } from '@/lib/branding'
import type { MedicalCertificateClinic } from './medical-certificate'

export const PATIENT_CHART_TEMPLATE_NAME = 'Dental Patient Chart'

export interface PatientChartData {
  chartNo: string
  visitDate: string
  patient: {
    fullName: string
    patientId: string
    age?: string
    sex?: string
  }
  clinicianName: string
  chiefComplaint: string
  historyPresentIllness: string
  pastMedicalHistory: string
  medicalAlerts: string
  pastDentalHistory: string
  socialFamilyHistory: string
  bloodPressure: string
  heartRate: string
  temperature: string
  extraOralExam: string
  intraOralExam: string
  radiographNotes: string
  diagnosis: string
  treatmentPlan: string
  estimatedCost: string
  completedProcedures: string
  materialsAnesthesia: string
  postOpInstructions: string
  nextVisit: string
  patientConsentName: string
  clinicalSummary: string
}

function clean(value: unknown) {
  return String(value ?? '').trim()
}

function sentence(label: string, value: string) {
  const content = clean(value)
  return content ? `${label}: ${content}` : ''
}

export function generateClinicalSummary(data: Omit<PatientChartData, 'clinicalSummary'>): string {
  const subjective = [
    sentence('Chief complaint', data.chiefComplaint),
    sentence('History', data.historyPresentIllness),
    sentence('Medical background', data.pastMedicalHistory),
    sentence('Alerts', data.medicalAlerts),
  ]
    .filter(Boolean)
    .join(' ')
  const vitals = [
    data.bloodPressure && `BP ${data.bloodPressure}`,
    data.heartRate && `Pulse ${data.heartRate}`,
    data.temperature && `Temp ${data.temperature}`,
  ]
    .filter(Boolean)
    .join(', ')
  const objective = [vitals, data.extraOralExam, data.intraOralExam, data.radiographNotes]
    .filter(Boolean)
    .join('. ')
  const plan = [
    data.treatmentPlan,
    data.completedProcedures,
    data.materialsAnesthesia,
    data.postOpInstructions,
    data.nextVisit && `Next visit: ${data.nextVisit}`,
  ]
    .filter(Boolean)
    .join('. ')

  return [
    `S: ${subjective || 'No subjective findings recorded.'}`,
    `O: ${objective || 'No objective findings recorded.'}`,
    `A: ${clean(data.diagnosis) || 'No diagnosis recorded.'}`,
    `P: ${plan || 'No plan recorded.'}`,
  ].join('\n')
}

function e(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function section(title: string, rows: Array<[string, string]>) {
  return `<section><h2>${e(title)}</h2>${rows
    .filter(([, value]) => clean(value))
    .map(
      ([label, value]) => `<div class="row"><strong>${e(label)}</strong><p>${e(value)}</p></div>`
    )
    .join('')}</section>`
}

export function renderPatientChartHtml(
  data: PatientChartData,
  clinic: MedicalCertificateClinic,
  signature?: string | null
) {
  const clinicName = resolveClinicName(clinic.name)
  const signatureHtml = signature
    ? `<img class="signature" src="${e(signature)}" alt="Patient signature">`
    : '<span>Not signed</span>'
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${e(data.chartNo)} - Dental Patient Chart</title><style>
@page{size:A4;margin:13mm}*{box-sizing:border-box}body{margin:0;background:#eef2f6;color:#172033;font:11px/1.45 Arial,sans-serif}.toolbar{max-width:210mm;margin:14px auto 0;text-align:right}.toolbar button{border:0;border-radius:20px;background:#086be6;color:white;padding:10px 18px;font-weight:700}.paper{width:210mm;margin:14px auto;background:white;padding:14mm;box-shadow:0 15px 45px #17203324}.header{text-align:center;border-bottom:2px solid #173f72;padding-bottom:5mm}.header h1{margin:1mm 0;font-size:23px}.header p{margin:0}.banner{margin:6mm 0;padding:4mm;border:1px solid #ef4444;background:#fff7f7}.banner strong{color:#b91c1c}.meta{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:4mm;margin-top:4mm}.meta div{border-bottom:1px solid #94a3b8;padding-bottom:1mm}section{break-inside:avoid;margin-top:6mm}h2{margin:0 0 3mm;color:#173f72;font-size:14px;border-bottom:1px solid #cbd5e1;padding-bottom:1.5mm}.row{display:grid;grid-template-columns:42mm 1fr;gap:4mm;margin:2mm 0}.row p{margin:0;white-space:pre-wrap}.summary{white-space:pre-wrap;border:1px solid #cbd5e1;padding:4mm;background:#f8fafc}.consent{display:grid;grid-template-columns:1fr 55mm;gap:8mm;align-items:end}.signature{max-width:52mm;max-height:25mm}.footer{margin-top:8mm;display:flex;justify-content:space-between;border-top:1px solid #cbd5e1;padding-top:3mm;color:#475569}@media print{body{background:white}.toolbar{display:none}.paper{width:auto;margin:0;padding:0;box-shadow:none}}
</style></head><body><div class="toolbar"><button onclick="window.print()">Print chart</button></div><main class="paper"><header class="header"><p>${e(clinicName)}</p><h1>Dental Patient Chart</h1><p>${e(data.chartNo)}</p></header><div class="banner"><strong>MEDICAL ALERTS:</strong> ${e(data.medicalAlerts || 'None recorded')}</div><div class="meta"><div><strong>Patient:</strong> ${e(data.patient.fullName)}</div><div><strong>MRN:</strong> ${e(data.patient.patientId)}</div><div><strong>Age/Sex:</strong> ${e([data.patient.age, data.patient.sex].filter(Boolean).join(' / '))}</div><div><strong>Visit:</strong> ${e(data.visitDate)}</div></div>
${section('1 Patient History and Background', [
  ['Chief Complaint (CC)', data.chiefComplaint],
  ['History of Present Illness (HPI)', data.historyPresentIllness],
  ['Past Medical History (PMH)', data.pastMedicalHistory],
  ['Past Dental History (PDH)', data.pastDentalHistory],
  ['Social and Family History', data.socialFamilyHistory],
])}
${section('2 Clinical Examination', [
  [
    'Vital Signs',
    [
      data.bloodPressure && `BP ${data.bloodPressure}`,
      data.heartRate && `Pulse ${data.heartRate}`,
      data.temperature && `Temp ${data.temperature}`,
    ]
      .filter(Boolean)
      .join(' | '),
  ],
  ['Extra-Oral Exam', data.extraOralExam],
  ['Intra-Oral Exam', data.intraOralExam],
  ['Radiographs', data.radiographNotes],
])}
${section('3 Diagnosis', [['Assessment', data.diagnosis]])}
${section('4 Treatment Plan', [
  ['Phased Proposed Plan', data.treatmentPlan],
  ['Estimated Cost', data.estimatedCost],
])}
${section('5 Treatment Done and Progress Notes', [
  ['Completed Procedures', data.completedProcedures],
  ['Materials and Anesthesia Used', data.materialsAnesthesia],
  ['Post-Op Instructions', data.postOpInstructions],
  ['Next Visit', data.nextVisit],
])}
<section><h2>Automated Clinical Note Summary</h2><div class="summary">${e(data.clinicalSummary)}</div></section><section><h2>Patient Consent</h2><div class="consent"><div>I, <strong>${e(data.patientConsentName || data.patient.fullName)}</strong>, approve recorded treatment plan and cost estimate.</div><div>${signatureHtml}</div></div></section><footer class="footer"><span>Clinician: ${e(data.clinicianName)}</span><span>${e(data.visitDate)}</span></footer></main></body></html>`
}
