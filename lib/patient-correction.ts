/** Registration fields an administrator can correct. */
export const CORRECTABLE_PATIENT_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'alternatePhone',
  'dateOfBirth',
  'gender',
  'bloodGroup',
  'address',
  'city',
  'state',
  'pincode',
  'occupation',
  'emergencyContactName',
  'emergencyContactPhone',
  'emergencyContactRelation',
] as const

function norm(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const text = String(value)
  return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text.slice(0, 10) : text
}

/**
 * Compare stored values with the submitted correction. Only fields that were
 * actually sent and really changed are returned (previous and updated values).
 */
export function diffPatientCorrection(
  existing: Record<string, unknown>,
  submitted: Record<string, unknown>
): { oldValues: Record<string, string | null>; newValues: Record<string, string | null> } {
  const oldValues: Record<string, string | null> = {}
  const newValues: Record<string, string | null> = {}
  for (const field of CORRECTABLE_PATIENT_FIELDS) {
    if (submitted[field] === undefined) continue
    const before = norm(existing[field])
    const after = norm(submitted[field])
    if (before !== after) {
      oldValues[field] = before
      newValues[field] = after
    }
  }
  return { oldValues, newValues }
}
