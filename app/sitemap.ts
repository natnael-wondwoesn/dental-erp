import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-url'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl()
  const routes = ['/', '/about', '/contact']

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
  }))
}
