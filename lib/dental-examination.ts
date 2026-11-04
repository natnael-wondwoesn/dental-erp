// Shared by the chart UI and the dental-examinations API.
// A tooth's current condition and its planned treatment are stored separately.

export const EXAM_CONDITIONS = [
  { value: 'HEALTHY', label: 'Healthy' },
  { value: 'CARIES', label: 'Caries' },
  { value: 'FILLED', label: 'Filled' },
  { value: 'CROWN', label: 'Crown' },
  { value: 'MISSING', label: 'Missing' },
  { value: 'ROOT_CANAL', label: 'Root Canal' },
] as const

export const EXAM_TREATMENTS = [
  { value: 'NONE', label: 'No treatment' },
  { value: 'FILLING', label: 'Filling' },
  { value: 'EXTRACTION', label: 'Extraction' },
  { value: 'ROOT_CANAL', label: 'Root Canal' },
  { value: 'CROWN', label: 'Crown' },
] as const

export type ExamTooth = {
  condition: string
  treatmentRequired: string
  notes: string
}

export type ExamTeeth = Record<string, ExamTooth>

const FDI = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 34, 35, 36, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48,
])
const CONDITIONS = new Set<string>(EXAM_CONDITIONS.map((c) => c.value))
const TREATMENTS = new Set<string>(EXAM_TREATMENTS.map((t) => t.value))

/** Returns a cleaned teeth map, or null when the payload is invalid. */
export function parseExamTeeth(input: unknown): ExamTeeth | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const out: ExamTeeth = {}
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    const t = raw as Partial<ExamTooth> | null
    if (!FDI.has(Number(key)) || !t || typeof t !== 'object') return null
    if (!CONDITIONS.has(String(t.condition))) return null
    const treatment = t.treatmentRequired ?? 'NONE'
    if (!TREATMENTS.has(String(treatment))) return null
    out[key] = {
      condition: String(t.condition),
      treatmentRequired: String(treatment),
      notes: String(t.notes ?? '').slice(0, 2000),
    }
  }
  return out
}
