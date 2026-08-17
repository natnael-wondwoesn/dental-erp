import { readFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

/**
 * Per-client website content.
 *
 * This module is the single boundary between the site and its content source.
 * Today that source is a committed JSON file. When the CMS lands, only
 * `loadSiteConfig` changes — no page or component reads a file directly.
 */

// Clinic names, doctor bios and service copy are per-client data, so they carry
// both languages inline rather than going through the shared t() catalog.
const localizedSchema = z.object({
  en: z.string().min(1),
  am: z.string(),
})

// CONTEXT.md invariant 7: Ethiopian numbers are E.164, +251 plus nine digits.
const ethiopianPhoneSchema = z.string().regex(/^\+251\d{9}$/, 'must be E.164, e.g. +251912345678')

export const siteConfigSchema = z.object({
  clinic: z.object({
    name: localizedSchema,
    tagline: localizedSchema,
    logo: z.string().optional(),
  }),
  location: z.object({
    region: z.string().min(1),
    city: z.string().min(1),
    subCity: z.string().min(1),
    woreda: z.string().min(1),
    kebele: z.string().optional(),
    landmark: z.string().optional(),
    // zod 4 top-level format validators. The older z.string().url() /
    // .email() methods still work but are deprecated in this major version.
    mapEmbedUrl: z.url(),
  }),
  contact: z.object({
    phones: z.array(ethiopianPhoneSchema).min(1),
    telegram: z.string().optional(),
    whatsapp: ethiopianPhoneSchema.optional(),
    email: z.email(),
  }),
  hours: z
    .array(
      z.object({
        day: localizedSchema,
        open: z.string().regex(/^\d{2}:\d{2}$/),
        close: z.string().regex(/^\d{2}:\d{2}$/),
      })
    )
    .min(1),
  services: z.array(z.object({ title: localizedSchema, copy: localizedSchema })).min(1),
  doctors: z.array(
    z.object({
      name: z.string().min(1),
      credentials: localizedSchema,
      bio: localizedSchema,
      photo: z.string().optional(),
    })
  ),
  about: z.object({
    story: localizedSchema,
    metrics: z.array(z.object({ value: z.string(), label: localizedSchema })),
  }),
  social: z
    .object({
      facebook: z.url().optional(),
      instagram: z.url().optional(),
      tiktok: z.url().optional(),
      youtube: z.url().optional(),
    })
    .optional(),
})

export type SiteConfig = z.infer<typeof siteConfigSchema>
export type Localized = z.infer<typeof localizedSchema>

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

export function localize(value: Localized, locale: 'en' | 'am'): string {
  return value[locale] || value.en
}

/** Test helper. Production code has no reason to call this. */
export function __resetSiteConfigCache(): void {
  cached = null
}
