import { readFileSync } from 'node:fs'
import path from 'node:path'
import { siteConfigSchema, type SiteConfig } from './site-config.shared'

export { localize, siteConfigSchema, type Localized, type SiteConfig } from './site-config.shared'

/**
 * Per-client website content.
 *
 * This module is the single boundary between the site and its content source.
 * Today that source is a committed JSON file. When the CMS lands, only
 * `loadSiteConfig` changes — no page or component reads a file directly.
 */

export function resolveSiteConfigPath(): string {
  // An absolute override lets a client mount an edited file without a rebuild.
  if (process.env.SITE_CONFIG_PATH) return process.env.SITE_CONFIG_PATH
  const siteId = process.env.SITE_ID || 'default'
  return path.join(process.cwd(), 'config', 'sites', `${siteId}.json`)
}

let cached: SiteConfig | null = null

export function loadSiteConfig(): SiteConfig {
  if (cached) return cached

  const configPath = resolveSiteConfigPath()

  let raw: string
  try {
    raw = readFileSync(configPath, 'utf8')
  } catch {
    throw new Error(
      `Site config not found at ${configPath}. Set SITE_ID to a file in config/sites/, or SITE_CONFIG_PATH to an absolute path.`
    )
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch (error) {
    throw new Error(`Site config at ${configPath} is not valid JSON: ${String(error)}`)
  }

  const parsed = siteConfigSchema.safeParse(json)
  if (!parsed.success) {
    // Fail loudly at startup. A half-valid config must never reach a patient.
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid site config at ${configPath}:\n${issues}`)
  }

  cached = parsed.data
  return cached
}

/** Test helper. Production code has no reason to call this. */
export function __resetSiteConfigCache(): void {
  cached = null
}
