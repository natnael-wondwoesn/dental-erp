import { getProductTier } from '@/lib/product-tier'
import { loadSiteConfig } from '@/lib/site-config'
import { SiteProvider } from '@/components/site/site-provider'
import { SiteFooter } from '@/components/site/site-footer'
import { publicBrand } from '@/lib/saas/public-brand'

// Server component. The only place in the (site) group that touches process.env
// or the filesystem; everything below it is client-side and receives props.
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const tier = getProductTier()
  const config = structuredClone(loadSiteConfig())
  const hasClinicSpecificProfile = Boolean(config.clinic.heroImage)
  const profile = await publicBrand()
  if (profile) {
    const brand = profile.branding
    const name = brand.displayName || profile.name
    config.clinic.name = { en: name, am: brand.nameAm || name }
    config.contact.email = brand.contactEmail || config.contact.email
    config.contact.phones = hasClinicSpecificProfile
      ? Array.from(
          new Set(
            [brand.contactPhone, ...config.contact.phones].filter((phone): phone is string =>
              Boolean(phone)
            )
          )
        )
      : brand.contactPhone
        ? [brand.contactPhone]
        : []
    if (!hasClinicSpecificProfile) {
      config.contact.telegram = ''
      config.contact.whatsapp = ''
      config.doctors = []
      config.about.metrics = []
      config.location.mapEmbedUrl = ''
    }
    config.location.landmark = brand.address || config.location.landmark || ''
  }

  return (
    <SiteProvider config={config} tier={tier}>
      {children}
      <SiteFooter />
    </SiteProvider>
  )
}
