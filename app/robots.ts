import type { MetadataRoute } from 'next'
import { getProductTier } from '@/lib/product-tier'
import { getSiteUrl } from '@/lib/site-url'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl()

  // In the landing tier, robots.txt itself must not name any ERP path.
  // /robots.txt is one of the few paths the tier gate allows through, so a
  // static disallow list here would hand an unauthenticated prober the exact
  // map of ERP routes the middleware's 404 policy exists to hide. There is
  // simply nothing to disallow when those routes don't publicly exist.
  if (getProductTier() === 'landing') {
    return {
      rules: {
        userAgent: '*',
        allow: '/',
      },
      sitemap: `${baseUrl}/sitemap.xml`,
    }
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard', '/login', '/portal', '/pay'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
