import { NextResponse, type NextRequest } from 'next/server'
import { getProductTier } from '@/lib/product-tier'

/**
 * Tier gate.
 *
 * This is the only load-bearing enforcement separating the landing tier from
 * the full suite. Navigation filtering elsewhere is presentation only.
 *
 * It does NOT authenticate. Authentication and RBAC live in FastAPI, per
 * docs/adr/0001-python-postgres-erp-boundaries.md.
 */

/**
 * Paths reachable when PRODUCT_TIER=landing. Everything not matched here 404s.
 *
 * Deny-by-default is deliberate: a new ERP route added later is blocked
 * automatically, whereas a denylist would leak it until someone remembered.
 *
 * Decided policy:
 *   - The public marketing pages, plus the SEO and web-app metadata files
 *     Next serves for them (robots.txt, sitemap.xml, icon, manifest).
 *   - Static asset prefixes not already excluded by the matcher below.
 *   - Everything else, including all of /api/*, 404s. /api/health is
 *     deliberately NOT allowlisted: a 200 there would tell a prober an API
 *     layer exists behind a site that is meant to look purely static.
 */
const ALLOWED_EXACT = new Set([
  '/',
  '/about',
  '/contact',
  '/robots.txt',
  '/sitemap.xml',
  '/icon.svg',
  '/manifest.json',
])

const ALLOWED_PREFIXES = ['/_next/', '/assets/', '/fonts/']

// Matches a "." or ".." path segment, optionally followed by a Tomcat-style
// ";matrix-param" suffix before the segment boundary — e.g. "/assets/..;/x",
// where a downstream router that ignores ";..." parameters would treat the
// segment as plain "..". This is tested against the percent-decoded pathname
// (see isDotSegmentPath below), which is what lets a single pattern also
// catch "%2e", "%2E" and "%2f"-encoded traversal without spelling out every
// encoded variant here.
//
// In production, request.nextUrl.pathname is already dot-segment-normalised
// by WHATWG URL parsing before it reaches this function, so none of this
// ever fires against a real request. It exists because isAllowedInLandingTier
// is exported and could be called directly — by tests, or by future code —
// with a raw string that has not been through that normalisation. It does
// NOT reject dots that are part of an ordinary filename (e.g. "logo.min.js",
// "..hidden.css", "a..b/c.js", ".well-known/x") — only a segment that is
// wholly "." or ".." (plus an optional matrix-param suffix).
const DOT_SEGMENT = /(^|\/)\.{1,2}(;[^/]*)?(\/|$)/

function isDotSegmentPath(pathname: string): boolean {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    // Malformed percent-encoding (e.g. "/assets/%zz"). Something that can't
    // even be decoded is not a path we recognise, so deny it rather than
    // testing the raw, still partially-encoded string and risking a false
    // negative.
    return true
  }
  return DOT_SEGMENT.test(decoded)
}

function isAllowed(pathname: string): boolean {
  if (isDotSegmentPath(pathname)) return false

  // Normalise a single trailing slash before the exact-match lookup (but keep
  // '/' itself as-is). Today Next's built-in /:path+/ -> /:path+ redirect
  // means middleware never actually sees "/about/", but that redirect is
  // config-dependent (trailingSlash / skipTrailingSlashRedirect could disable
  // it), so this normalisation must not rely on it.
  const normalised =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

  if (ALLOWED_EXACT.has(normalised)) return true
  return ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function isAllowedInLandingTier(pathname: string): boolean {
  return isAllowed(pathname)
}

export function middleware(request: NextRequest): NextResponse {
  if (getProductTier() === 'full') return NextResponse.next()
  if (isAllowedInLandingTier(request.nextUrl.pathname)) return NextResponse.next()

  // 404, not 403 and not a redirect: a landing client's server should give a
  // prober no signal that an ERP is installed.
  return new NextResponse(null, { status: 404 })
}

export const config = {
  // Next already skips these; excluding them here avoids paying middleware
  // cost on every asset request. Trailing slashes on assets/fonts pin the
  // exclusion to a path segment boundary so it can't also match unrelated
  // paths like /assetsanything or /fonts-x.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets/|fonts/).*)'],
}
