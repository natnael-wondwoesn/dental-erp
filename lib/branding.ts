export const LEMLEM_CLINIC_NAME = 'D/R Lemlem Special Dental Clinic'
export const LEMLEM_CLINIC_EMAIL = 'hello@lemlemdental.et'

export function resolveClinicName(name?: string | null): string {
  const value = name?.trim()
  if (!value || /dentix|sunny\s*smile/i.test(value)) return LEMLEM_CLINIC_NAME
  return value
}

export function resolveClinicEmail(email?: string | null): string {
  const value = email?.trim()
  if (!value || /@(dentix|sunnysmile)\.et$/i.test(value)) return LEMLEM_CLINIC_EMAIL
  return value
}
