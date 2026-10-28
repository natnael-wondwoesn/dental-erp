import { requestSaaSAccess, saasEnforcement } from './server'

export async function brandClinic<T extends { name: string }>(tenantId: string, clinic: T) {
  if (saasEnforcement() === 'disabled') return clinic
  const policy = await requestSaaSAccess(tenantId)
  const brand = policy.branding
  return {
    ...clinic,
    name: brand.displayName || policy.name || clinic.name,
    nameAm: brand.nameAm || undefined,
    ...(brand.logo ? { logo: brand.logo } : {}),
    ...(brand.address ? { address: brand.address } : {}),
    ...(brand.contactEmail ? { email: brand.contactEmail } : {}),
    ...(brand.contactPhone ? { phone: brand.contactPhone } : {}),
  }
}
