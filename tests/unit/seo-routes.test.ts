import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const ORIGINAL_SITE_URL = process.env.SITE_URL
const ORIGINAL_PRODUCT_TIER = process.env.PRODUCT_TIER

async function loadModules() {
  const [{ default: robots }, { default: sitemap }] = await Promise.all([
    import('@/app/robots'),
    import('@/app/sitemap'),
  ])
  return { robots, sitemap }
}

// ERP route names that must never appear anywhere in a landing-tier
// robots.txt. /robots.txt is one of the few paths the tier gate allows
// through in the landing tier, so a static disallow list naming these routes
// would hand an unauthenticated prober the exact map the middleware's 404
// policy exists to hide.
const ERP_TERMS = ['dashboard', 'portal', 'login', 'pay', 'api']

afterEach(() => {
  if (ORIGINAL_SITE_URL === undefined) delete process.env.SITE_URL
  else process.env.SITE_URL = ORIGINAL_SITE_URL

  if (ORIGINAL_PRODUCT_TIER === undefined) delete process.env.PRODUCT_TIER
  else process.env.PRODUCT_TIER = ORIGINAL_PRODUCT_TIER
})

describe('sitemap', () => {
  beforeEach(() => {
    delete process.env.SITE_URL
  })

  it('returns exactly the three public site routes', async () => {
    const { sitemap } = await loadModules()
    const entries = sitemap()
    expect(entries).toHaveLength(3)
    expect(entries.map((entry) => entry.url)).toEqual([
      'http://localhost:3000/',
      'http://localhost:3000/about',
      'http://localhost:3000/contact',
    ])
  })

  it('builds absolute URLs from SITE_URL when set', async () => {
    process.env.SITE_URL = 'https://clinic.example.et'
    const { sitemap } = await loadModules()
    const entries = sitemap()
    expect(entries.map((entry) => entry.url)).toEqual([
      'https://clinic.example.et/',
      'https://clinic.example.et/about',
      'https://clinic.example.et/contact',
    ])
  })

  it('falls back to localhost when SITE_URL is unset', async () => {
    const { sitemap } = await loadModules()
    const entries = sitemap()
    expect(entries[0].url).toBe('http://localhost:3000/')
  })
})

describe('robots in full tier', () => {
  beforeEach(() => {
    delete process.env.SITE_URL
    process.env.PRODUCT_TIER = 'full'
  })

  it('disallows /dashboard and /api/', async () => {
    const { robots } = await loadModules()
    const result = robots()
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules
    const disallow = Array.isArray(rules.disallow) ? rules.disallow : [rules.disallow]
    expect(disallow).toContain('/dashboard')
    expect(disallow).toContain('/api/')
  })

  it('mentions the ERP surface somewhere in the output', async () => {
    const { robots } = await loadModules()
    const result = robots()
    const serialised = JSON.stringify(result)
    for (const term of ERP_TERMS) {
      expect(serialised).toContain(term)
    }
  })

  it('points sitemap at SITE_URL/sitemap.xml when SITE_URL is set', async () => {
    process.env.SITE_URL = 'https://clinic.example.et'
    const { robots } = await loadModules()
    const result = robots()
    expect(result.sitemap).toBe('https://clinic.example.et/sitemap.xml')
  })

  it('falls back to localhost when SITE_URL is unset', async () => {
    const { robots } = await loadModules()
    const result = robots()
    expect(result.sitemap).toBe('http://localhost:3000/sitemap.xml')
  })
})

describe('robots in landing tier', () => {
  beforeEach(() => {
    delete process.env.SITE_URL
    process.env.PRODUCT_TIER = 'landing'
  })

  // CRITICAL fix: a static disallow list would leak the ERP surface through
  // the one path (/robots.txt) the tier gate lets an unauthenticated client
  // reach. Scan the whole serialised structure, not one field — the point is
  // that none of these terms appear anywhere, including inside allow/rules
  // shapes this test doesn't otherwise know about.
  it('never mentions the ERP surface anywhere in the output', async () => {
    const { robots } = await loadModules()
    const result = robots()
    const serialised = JSON.stringify(result)
    for (const term of ERP_TERMS) {
      expect(serialised).not.toContain(term)
    }
  })

  it('still allows the site root and points at the sitemap', async () => {
    const { robots } = await loadModules()
    const result = robots()
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules
    expect(rules.allow).toBe('/')
    expect(result.sitemap).toBe('http://localhost:3000/sitemap.xml')
  })

  it('points sitemap at SITE_URL/sitemap.xml when SITE_URL is set', async () => {
    process.env.SITE_URL = 'https://clinic.example.et'
    const { robots } = await loadModules()
    const result = robots()
    expect(result.sitemap).toBe('https://clinic.example.et/sitemap.xml')
  })
})
