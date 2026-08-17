import { getProductTier } from '@/lib/product-tier'
import { loadSiteConfig } from '@/lib/site-config'
import { SiteProvider } from '@/components/site/site-provider'
import { SiteFooter } from '@/components/site/site-footer'

// Server component. The only place in the (site) group that touches process.env
// or the filesystem; everything below it is client-side and receives props.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const tier = getProductTier()
  const config = loadSiteConfig()

  return (
    <SiteProvider config={config} tier={tier}>
      {children}
      <SiteFooter />
    </SiteProvider>
  )
}
