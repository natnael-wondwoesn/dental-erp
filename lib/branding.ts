export function resolveClinicName(name?: string | null): string {
  const value = name?.trim()
  if (!value) return 'Dental Clinic'
  return value
}

export function resolveClinicEmail(email?: string | null): string {
  const value = email?.trim()
  if (!value) return ''
  return value
}
