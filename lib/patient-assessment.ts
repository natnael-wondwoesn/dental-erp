export const ASSESSMENT_MAX_LENGTH = 10_000

export type AssessmentInput = { vitalSigns: string | null; others: string | null }

/** Trim both boxes; at least one must contain text. Returns an error message otherwise. */
export function parseAssessmentInput(
  body: unknown
): { ok: true; value: AssessmentInput } | { ok: false; error: string } {
  const raw = (body ?? {}) as Record<string, unknown>
  const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const vitalSigns = clean(raw.vitalSigns)
  const others = clean(raw.others)
  if (!vitalSigns && !others) {
    return { ok: false, error: 'Enter vital signs or other notes before saving.' }
  }
  if (vitalSigns.length > ASSESSMENT_MAX_LENGTH || others.length > ASSESSMENT_MAX_LENGTH) {
    return { ok: false, error: `Each box is limited to ${ASSESSMENT_MAX_LENGTH} characters.` }
  }
  return { ok: true, value: { vitalSigns: vitalSigns || null, others: others || null } }
}
