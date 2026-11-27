import type { Prisma } from '@prisma/client'

/**
 * Carry the conditions ticked in an orthodontic assessment onto the patient's medical history.
 * Only ever switches things ON and appends text: an assessment never clears what another
 * clinician recorded. "None" and an empty selection change nothing.
 */
export function medicalHistoryFromConditions(
  conditions: readonly string[],
  other: string | null | undefined,
  existing: { diabetesType?: string | null; otherConditions?: string | null } | null
): Prisma.MedicalHistoryUpdateInput {
  const has = (code: string) => conditions.includes(code)
  const data: Prisma.MedicalHistoryUpdateInput = {}
  if (has('DIABETES_1') || has('DIABETES_2')) {
    data.hasDiabetes = true
    const type = has('DIABETES_1') && has('DIABETES_2') ? '1 & 2' : has('DIABETES_1') ? '1' : '2'
    data.diabetesType = `Type ${type}`
  }
  if (has('HYPERTENSION')) data.hasHypertension = true
  if (has('HEART')) data.hasHeartDisease = true
  if (has('ASTHMA')) data.hasAsthma = true
  if (has('PREGNANCY')) data.isPregnant = true
  if (has('HIV')) data.hasHiv = true
  if (has('LIVER')) data.hasHepatitis = true

  const lines = (existing?.otherConditions ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const add = (line: string) => {
    if (!lines.some((l) => l.toLowerCase() === line.toLowerCase())) lines.push(line)
  }
  if (has('KIDNEY')) add('Kidney problems')
  if (has('OTHER') && other?.trim()) add(other.trim())
  const joined = lines.join('\n')
  if (joined !== (existing?.otherConditions ?? '').trim()) data.otherConditions = joined
  return data
}
