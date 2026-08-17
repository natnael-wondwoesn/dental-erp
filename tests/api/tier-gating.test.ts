// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import { isAllowedInLandingTier, middleware } from '@/middleware'

const ORIGINAL = process.env.PRODUCT_TIER

function request(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, 'https://clinic.example.et'))
}

function status(pathname: string): number {
  return middleware(request(pathname)).status
}

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.PRODUCT_TIER
  else process.env.PRODUCT_TIER = ORIGINAL
})

describe('full tier', () => {
  beforeEach(() => {
    process.env.PRODUCT_TIER = 'full'
  })

  it.each(['/', '/about', '/contact', '/dashboard', '/login', '/portal', '/api/patients'])(
    'passes %s through untouched',
    (pathname) => {
      expect(status(pathname)).toBe(200)
    }
  )
})

describe('landing tier', () => {
  beforeEach(() => {
    process.env.PRODUCT_TIER = 'landing'
  })

  it.each([
    '/',
    '/about',
    '/contact',
    '/robots.txt',
    '/sitemap.xml',
    '/icon.svg',
    '/manifest.json',
  ])('serves the public site path %s', (pathname) => {
    expect(status(pathname)).toBe(200)
  })

  // Genuine coverage of each allowed prefix. (A bare "/_next/data/foo.json"
  // case would pass for the wrong reason: Next's own routing strips the data
  // prefix before middleware ever sees it, so that case would still pass
  // with "/_next/" deleted from the prefix list entirely.)
  it.each(['/assets/logo.png', '/fonts/NotoSansEthiopic.woff2', '/_next/static/chunks/main.js'])(
    'serves the static asset path %s',
    (pathname) => {
      expect(status(pathname)).toBe(200)
    }
  )

  // Trailing-slash normalisation must not depend on Next's built-in
  // /:path+/ -> /:path+ redirect, which is disabled by trailingSlash or
  // skipTrailingSlashRedirect in next.config.js.
  it.each(['/about/', '/contact/'])(
    'serves the public site path %s with a trailing slash',
    (pathname) => {
      expect(status(pathname)).toBe(200)
    }
  )

  it('still 404s an ERP path with a trailing slash', () => {
    expect(status('/dashboard/')).toBe(404)
  })

  // Regression guard for the DOT_SEGMENT deny check: dots that are part of an
  // ordinary filename or directory name, not a whole "." / ".." segment, must
  // keep working. Breaking any of these would kill real, currently-shipping
  // asset paths (e.g. hashed JS chunk filenames) on every landing site.
  it.each([
    '/assets/logo.min.js',
    '/fonts/noto.v2.woff2',
    '/_next/static/chunks/main.a1b2c3.js',
    '/assets/..hidden.css',
    '/assets/a..b/c.js',
    '/assets/.well-known/x',
  ])('still serves the real asset path %s (dots are not a whole path segment)', (pathname) => {
    expect(status(pathname)).toBe(200)
  })

  it.each([
    '/dashboard',
    '/dashboard/patients',
    '/login',
    '/portal',
    '/portal/book',
    '/pay/abc123',
    '/api/patients',
    '/api/auth/login',
    '/api/dashboard/stats',
  ])('returns 404 for the ERP path %s', (pathname) => {
    expect(status(pathname)).toBe(404)
  })

  // Pins the security decision: /api/health is deliberately NOT allowlisted.
  // A 200 there would tell a prober an API layer exists behind a site that
  // is meant to look purely static, even though it's a harmless-sounding
  // uptime-monitoring endpoint.
  it('returns 404 for /api/health, even though it looks like a harmless health check', () => {
    expect(status('/api/health')).toBe(404)
  })

  it('returns 404 rather than a redirect, so probing cannot confirm the ERP exists', () => {
    const response = middleware(request('/dashboard'))
    expect(response.status).toBe(404)
    expect(response.headers.get('location')).toBeNull()
  })
})

describe('isAllowedInLandingTier', () => {
  it('allows the site root', () => {
    expect(isAllowedInLandingTier('/')).toBe(true)
  })

  it('blocks an unknown path by default rather than allowing it', () => {
    expect(isAllowedInLandingTier('/some/unmapped/route')).toBe(false)
  })

  // These are already blocked today. Pinned so a future refactor — e.g.
  // swapping the exact-match/prefix checks for a looser
  // pathname.includes(...) — breaks a test instead of silently reopening a
  // bypass.
  it.each([
    '/about/../dashboard',
    '/./dashboard',
    '/assets/../../dashboard',
    '/Dashboard',
    '/%64ashboard',
    '//dashboard',
    '/dashboard?next=/about',
  ])('blocks the bypass attempt %s', (pathname) => {
    expect(isAllowedInLandingTier(pathname)).toBe(false)
  })

  // Percent-encoded and matrix-param dot-segment variants. The %2e forms are
  // unreachable via a real request (WHATWG URL parsing normalises them
  // before middleware runs), but isAllowedInLandingTier is called directly
  // here with the raw string, same as the bypass attempts above — and
  // "..;/" survives URL parsing intact even on a real request, so this one
  // is a genuine, reachable vector, not just a defence-in-depth pin.
  it.each([
    '/assets/%2e%2e/%2e%2e/dashboard',
    '/assets/%2E%2E/dashboard',
    '/assets/.%2e/dashboard',
    '/assets/..%2f..%2fdashboard',
    '/assets/..;/dashboard',
  ])('blocks the encoded bypass attempt %s', (pathname) => {
    expect(isAllowedInLandingTier(pathname)).toBe(false)
  })
})

describe('an invalid PRODUCT_TIER', () => {
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.PRODUCT_TIER
    else process.env.PRODUCT_TIER = ORIGINAL
  })

  it('makes middleware throw rather than route the request under an unknown tier', () => {
    process.env.PRODUCT_TIER = 'Landing'
    expect(() => middleware(request('/dashboard'))).toThrow(/Invalid PRODUCT_TIER/)
  })
})
