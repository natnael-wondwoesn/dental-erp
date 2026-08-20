export const SUNNY_SMILE_CLINIC_NAME = 'Sunny Smile Speciality Clinic'
export const SUNNY_SMILE_CLINIC_EMAIL = 'hello@sunnysmile.et'

export function resolveClinicName(name?: string | null): string {
  const value = name?.trim()
  if (!value || /dentix/i.test(value)) return SUNNY_SMILE_CLINIC_NAME
  return value
}

export function resolveClinicEmail(email?: string | null): string {
  const value = email?.trim()
  if (!value || /@dentix\.et$/i.test(value)) return SUNNY_SMILE_CLINIC_EMAIL
  return value
}
