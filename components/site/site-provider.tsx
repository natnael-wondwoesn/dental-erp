'use client'

import { createContext, useCallback, useContext } from 'react'

import { useLanguage } from '@/lib/i18n'
import type { ProductTier } from '@/lib/product-tier'
import { localize, type Localized, type SiteConfig } from '@/lib/site-config.shared'

interface SiteContextValue {
  config: SiteConfig
  tier: ProductTier
}

const SiteContext = createContext<SiteContextValue | null>(null)

/**
 * Carries server-resolved config and tier across the client boundary.
 *
 * The tier cannot be read in a client component — process.env.PRODUCT_TIER is
 * server-only by design — so the (site) layout resolves it and passes it here.
 */
export function SiteProvider({
  config,
  tier,
  children,
}: {
  config: SiteConfig
  tier: ProductTier
  children: React.ReactNode
}) {
  return <SiteContext.Provider value={{ config, tier }}>{children}</SiteContext.Provider>
}

export function useSite(): SiteContextValue {
  const value = useContext(SiteContext)
  if (!value) throw new Error('useSite must be used inside SiteProvider')
  return value
}

/**
 * Picks the right half of a bilingual config field for the active locale.
 * Config content uses {en, am} pairs; t() stays for shared UI chrome.
 */
export function useLocalize(): (value: Localized) => string {
  const { locale } = useLanguage()
  return useCallback((value: Localized) => localize(value, locale), [locale])
}
