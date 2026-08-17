/**
 * Deployment base URL, used to build absolute URLs in SEO metadata routes
 * (app/robots.ts, app/sitemap.ts).
 *
 * This is deployment config, not clinic content, so it does not belong in
 * lib/site-config.ts.
 */

const DEFAULT_SITE_URL = 'http://localhost:3000'

export function getSiteUrl(): string {
  return process.env.SITE_URL || DEFAULT_SITE_URL
}
