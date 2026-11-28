export const ASSESSMENT_MAX_LENGTH = 10_000

export type AssessmentInput = { vitalSign: string | null; assessment: string | null }

/** Trim both boxes; at least one must contain text. Returns an error message otherwise. */
export function parseAssessmentInput(
  body: unknown
): { ok: true; value: AssessmentInput } | { ok: false; error: string } {
  const raw = (body ?? {}) as Record<string, unknown>
  const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const vitalSign = clean(raw.vitalSign)
  const assessment = clean(raw.assessment)
  if (!vitalSign && !assessment) {
    return { ok: false, error: 'Enter vital signs or an assessment before saving.' }
  }
  if (vitalSign.length > ASSESSMENT_MAX_LENGTH || assessment.length > ASSESSMENT_MAX_LENGTH) {
    return { ok: false, error: `Each box is limited to ${ASSESSMENT_MAX_LENGTH} characters.` }
  }
  return { ok: true, value: { vitalSign: vitalSign || null, assessment: assessment || null } }
}
