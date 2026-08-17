export type ProductTier = 'landing' | 'full'

const TIERS: readonly ProductTier[] = ['landing', 'full'] as const

/**
 * Resolves the product tier this deployment is running as.
 *
 * Read server-side only. Never expose this through NEXT_PUBLIC_*, which Next
 * inlines at build time and would freeze the tier into the image.
 */
export function getProductTier(): ProductTier {
  const raw = process.env.PRODUCT_TIER

  // Unset means an ordinary full-suite deployment. Defaulting here keeps every
  // existing test, dev command, and deploy working with no change.
  if (raw === undefined || raw === '') return 'full'

  if (!TIERS.includes(raw as ProductTier)) {
    // Deliberately fatal. A typo like PRODUCT_TIER=Landing must not fall back
    // to a working ERP on a landing-only client's server.
    throw new Error(`Invalid PRODUCT_TIER "${raw}". Expected one of: ${TIERS.join(', ')}.`)
  }

  return raw as ProductTier
}

export function isFullSuite(): boolean {
  return getProductTier() === 'full'
}
