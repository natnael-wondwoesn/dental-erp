export const ASSESSMENT_MAX_LENGTH = 10_000
export const PROCEDURE_MAX_LENGTH = 191
export const COST_MAX = 99_999_999.99

export type AssessmentInput = {
  vitalSigns: string | null
  others: string | null
  procedure: string | null
  cost: number | null
}

/**
 * Trim the text boxes and validate the cost (ETB, optional, 0 or more, at most 2 decimals).
 * At least one of vital signs, others or procedure must be filled in.
 */
export function parseAssessmentInput(
  body: unknown
): { ok: true; value: AssessmentInput } | { ok: false; error: string } {
  const raw = (body ?? {}) as Record<string, unknown>
  const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const vitalSigns = clean(raw.vitalSigns)
  const others = clean(raw.others)
  const procedure = clean(raw.procedure)

  if (!vitalSigns && !others && !procedure) {
    return { ok: false, error: 'Enter vital signs, other notes or a procedure before saving.' }
  }
  if (vitalSigns.length > ASSESSMENT_MAX_LENGTH || others.length > ASSESSMENT_MAX_LENGTH) {
    return { ok: false, error: `Each box is limited to ${ASSESSMENT_MAX_LENGTH} characters.` }
  }
  if (procedure.length > PROCEDURE_MAX_LENGTH) {
    return { ok: false, error: `Procedure is limited to ${PROCEDURE_MAX_LENGTH} characters.` }
  }

  let cost: number | null = null
  const rawCost = raw.cost
  if (rawCost !== undefined && rawCost !== null && String(rawCost).trim() !== '') {
    const text = String(rawCost).trim()
    const value = Number(text)
    if (!/^\d+(\.\d{1,2})?$/.test(text) || !Number.isFinite(value) || value > COST_MAX) {
      return {
        ok: false,
        error: 'Treatment cost must be an amount in ETB with at most 2 decimals.',
      }
    }
    cost = value
  }

  return {
    ok: true,
    value: {
      vitalSigns: vitalSigns || null,
      others: others || null,
      procedure: procedure || null,
      cost,
    },
  }
}
