import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-url'
import { getProductTier } from '@/lib/product-tier'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl()
  const routes = ['/', '/about', '/contact']
  if (getProductTier() === 'full') routes.push('/book')

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
  }))
}
