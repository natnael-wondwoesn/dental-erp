import { z } from 'zod'

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

export function localize(value: Localized, locale: 'en' | 'am'): string {
  return value[locale] || value.en
}
