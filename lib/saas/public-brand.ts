import { headers } from 'next/headers'
import { saasEnforcement, saasFetch } from './server'
import type { SaaSAccess } from './catalog'

type PublicBrand = {
  tenantId: string
  name: string
  slug: string
  branding: SaaSAccess['branding']
}

export async function resolvePublicBrand(hostname: string): Promise<PublicBrand | null> {
  const mode = saasEnforcement()
  if (mode === 'disabled') return null
  try {
    if (mode === 'offline') {
      // Local identity comes from vendor-provisioned installation configuration,
      // never from a request tenant ID. Branding works without a network.
      const tenantId = process.env.SAAS_TENANT_ID
      if (!tenantId) return null
      const { prisma } = await import('@/lib/prisma')
      const clinic = await prisma.hospital.findUnique({ where: { id: tenantId } })
      return clinic
        ? {
            tenantId,
            name: clinic.name,
            slug: clinic.slug,
            branding: {
              displayName: clinic.name,
              logo: clinic.logo || undefined,
              contactEmail: clinic.email || '',
              contactPhone: clinic.phone || '',
              address: clinic.address || '',
            },
          }
        : null
    }
    if (!hostname || !/^[a-z0-9.-]+$/.test(hostname)) return null
    const response = await saasFetch(`branding?hostname=${encodeURIComponent(hostname)}`)
    return response.ok ? ((await response.json()) as PublicBrand) : null
  } catch {
    return null
  }
}

export async function publicBrand() {
  const hostname = (await headers()).get('host')?.split(':')[0]?.toLowerCase() || ''
  return resolvePublicBrand(hostname)
}
