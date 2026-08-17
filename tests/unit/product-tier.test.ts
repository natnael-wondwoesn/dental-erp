import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const ORIGINAL = process.env.PRODUCT_TIER

async function loadModule() {
  // The module reads process.env at call time, not import time, but reset the
  // registry anyway so a future change to caching cannot silently break these.
  const mod = await import('@/lib/product-tier')
  return mod
}

describe('getProductTier', () => {
  beforeEach(() => {
    delete process.env.PRODUCT_TIER
  })

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.PRODUCT_TIER
    else process.env.PRODUCT_TIER = ORIGINAL
  })

  it('defaults to full when unset, so existing deployments are unchanged', async () => {
    const { getProductTier } = await loadModule()
    expect(getProductTier()).toBe('full')
  })

  it('defaults to full when set to an empty string', async () => {
    process.env.PRODUCT_TIER = ''
    const { getProductTier } = await loadModule()
    expect(getProductTier()).toBe('full')
  })

  it('returns landing when set to landing', async () => {
    process.env.PRODUCT_TIER = 'landing'
    const { getProductTier } = await loadModule()
    expect(getProductTier()).toBe('landing')
  })

  it('returns full when set to full', async () => {
    process.env.PRODUCT_TIER = 'full'
    const { getProductTier } = await loadModule()
    expect(getProductTier()).toBe('full')
  })

  it('throws on wrong casing rather than silently shipping an ERP', async () => {
    process.env.PRODUCT_TIER = 'Landing'
    const { getProductTier } = await loadModule()
    expect(() => getProductTier()).toThrow(/Landing/)
  })

  it('throws on an unrecognised tier and names the valid options', async () => {
    process.env.PRODUCT_TIER = 'enterprise'
    const { getProductTier } = await loadModule()
    expect(() => getProductTier()).toThrow(/landing, full/)
  })
})

describe('isFullSuite', () => {
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.PRODUCT_TIER
    else process.env.PRODUCT_TIER = ORIGINAL
  })

  it('is true in full tier', async () => {
    process.env.PRODUCT_TIER = 'full'
    const { isFullSuite } = await loadModule()
    expect(isFullSuite()).toBe(true)
  })

  it('is false in landing tier', async () => {
    process.env.PRODUCT_TIER = 'landing'
    const { isFullSuite } = await loadModule()
    expect(isFullSuite()).toBe(false)
  })
})
