export interface TreatmentClinicalSheet {
  treatmentDate: string
  temperatureC: string
  bloodPressure: string
  spo2: string
  pulseRate: string
  historyPresentIllness: string
  pastMedicalHistory: string
  provisionalDiagnosis: string
  extraoralExamination: string
  intraoralExamination: string
  assessment: string
  prescriptionPlan: string
  nextAppointment: string
  doctorSignature: string
}

export const EMPTY_TREATMENT_CLINICAL_SHEET: TreatmentClinicalSheet = {
  treatmentDate: '',
  temperatureC: '',
  bloodPressure: '',
  spo2: '',
  pulseRate: '',
  historyPresentIllness: '',
  pastMedicalHistory: '',
  provisionalDiagnosis: '',
  extraoralExamination: '',
  intraoralExamination: '',
  assessment: '',
  prescriptionPlan: '',
  nextAppointment: '',
  doctorSignature: '',
}

const FIELD_LIMITS: Record<keyof TreatmentClinicalSheet, number> = {
  treatmentDate: 10,
  temperatureC: 12,
  bloodPressure: 20,
  spo2: 8,
  pulseRate: 8,
  historyPresentIllness: 4000,
  pastMedicalHistory: 4000,
  provisionalDiagnosis: 4000,
  extraoralExamination: 4000,
  intraoralExamination: 4000,
  assessment: 4000,
  prescriptionPlan: 4000,
  nextAppointment: 40,
  doctorSignature: 191,
}

export function normalizeTreatmentClinicalSheet(value: unknown): TreatmentClinicalSheet | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  const sheet = { ...EMPTY_TREATMENT_CLINICAL_SHEET }
  for (const key of Object.keys(sheet) as Array<keyof TreatmentClinicalSheet>) {
    const raw = source[key]
    if (raw === undefined || raw === null) continue
    if (typeof raw !== 'string' && typeof raw !== 'number') continue
    sheet[key] = String(raw).trim().slice(0, FIELD_LIMITS[key])
  }

  if (sheet.treatmentDate && !/^\d{4}-\d{2}-\d{2}$/.test(sheet.treatmentDate)) {
    sheet.treatmentDate = ''
  }
  return Object.values(sheet).some(Boolean) ? sheet : null
}

export function serializeTreatmentClinicalSheet(value: unknown): string | null {
  const normalized = normalizeTreatmentClinicalSheet(value)
  return normalized ? JSON.stringify(normalized) : null
}

export function parseTreatmentClinicalSheet(value: unknown): TreatmentClinicalSheet | null {
  if (!value) return null
  try {
    return normalizeTreatmentClinicalSheet(typeof value === 'string' ? JSON.parse(value) : value)
  } catch {
    return null
  }
}
