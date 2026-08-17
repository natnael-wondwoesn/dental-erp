# Two-Tier Product Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one codebase that deploys either as a standalone clinic website (landing tier) or as that website plus the full ERP (full tier), selected by a runtime environment variable.

**Architecture:** A server-side `PRODUCT_TIER` env var gates the app. A new `middleware.ts` returns 404 for every non-allowlisted path when the tier is `landing`, which is the only load-bearing enforcement. Marketing pages move into an `app/(site)/` route group whose server layout reads the tier and a per-client JSON config, then hands both to a client context so existing `useLanguage()` behaviour is preserved.

**Tech Stack:** Next.js 16 (App Router, `output: 'standalone'`), React 19, TypeScript, zod 4, Tailwind, Vitest + Testing Library, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-08-17-two-tier-product-packaging-design.md`

## Global Constraints

- **Do not run `git commit` or `git add` in any task.** The user has instructed that all work stay in the working tree for their own review. Every task ends with a verification step instead of a commit step. This overrides the writing-plans skill's default commit step.
- `PRODUCT_TIER` is read **server-side only**. Never introduce `NEXT_PUBLIC_PRODUCT_TIER` — `NEXT_PUBLIC_*` is inlined at `next build` and would freeze the tier at build time, defeating the one-image goal.
- `PRODUCT_TIER` defaults to `'full'` when unset or empty. An unrecognised value throws at startup.
- Bilingual content in site config uses `{ en, am }` object pairs, never `t()` lookups. `t()` from `lib/i18n.tsx` remains correct for shared UI chrome only.
- Test runner is Vitest with `globals: true` — do not import `describe`/`it`/`expect`. The `@` alias maps to the repo root. Tests live under `tests/**/*.test.{ts,tsx}`.
- Tests that exercise `next/server` (middleware) must declare `// @vitest-environment node` at the top of the file; the project default is `jsdom`, which lacks a suitable `Request`.
- Existing test suites must stay green with no modification. The `full` default guarantees this — if a change breaks an existing test, the change is wrong.
- Ethiopian phone numbers are E.164 `+251` followed by 9 digits, per `CONTEXT.md` invariant 7.

---

## File Structure

**Created:**

| File                                  | Responsibility                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `lib/product-tier.ts`                 | Resolve and validate `PRODUCT_TIER`. No other logic.                                                |
| `lib/site-config.ts`                  | zod schema, loader, path resolution, localize helper. The single boundary the future CMS will swap. |
| `config/sites/default.json`           | Demo clinic config used in dev and tests.                                                           |
| `middleware.ts`                       | Tier gate. Allowlist policy + 404.                                                                  |
| `components/site/site-provider.tsx`   | Client context carrying config + tier; `useSite()`, `useLocalize()`.                                |
| `components/site/site-header.tsx`     | Site nav, language switcher, mobile menu, tier-conditional workspace link.                          |
| `components/site/site-footer.tsx`     | Footer, tier-conditional workspace link.                                                            |
| `components/site/home-sections.tsx`   | Hero, about, services, doctors sections rendered from config.                                       |
| `components/site/contact-details.tsx` | Phone/Telegram/WhatsApp/email links, hours table, address, map embed.                               |
| `app/(site)/layout.tsx`               | **Only server component in the group.** Reads tier + config, wraps in `SiteProvider`.               |
| `app/(site)/page.tsx`                 | Home. Moved from `app/page.tsx`.                                                                    |
| `app/(site)/about/page.tsx`           | About us.                                                                                           |
| `app/(site)/contact/page.tsx`         | Contact + location.                                                                                 |
| `docker-compose.landing.yml`          | App container only. No Postgres, Redis, or FastAPI.                                                 |
| `.env.landing.example`                | Landing-tier env template.                                                                          |
| `docs/DELIVERY.md`                    | Both handoff procedures + upgrade path.                                                             |

**Modified:** `app/page.tsx` (deleted, moved), `config/nav.ts` (tier filter), `Dockerfile` (copy `config/` into the standalone runner), `docker-compose.yml` and `docker-compose.dev.yml` (explicit `PRODUCT_TIER=full`), `.env.example`.

---

### Task 1: Tier resolution

**Files:**

- Create: `lib/product-tier.ts`
- Test: `tests/unit/product-tier.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `type ProductTier = 'landing' | 'full'`, `getProductTier(): ProductTier`, `isFullSuite(): boolean`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/product-tier.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/product-tier.test.ts`
Expected: FAIL — cannot resolve `@/lib/product-tier`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/product-tier.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/product-tier.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Verify nothing else broke**

Run: `npx tsc --noEmit`
Expected: no new errors.

**Do not commit.** Leave the changes in the working tree.

---

### Task 2: Site config schema and loader

**Files:**

- Create: `lib/site-config.ts`, `config/sites/default.json`
- Test: `tests/unit/site-config.test.ts`

**Interfaces:**

- Consumes: nothing from Task 1.
- Produces: `type Localized = { en: string; am: string }`, `type SiteConfig`, `siteConfigSchema`, `resolveSiteConfigPath(): string`, `loadSiteConfig(): SiteConfig`, `localize(value: Localized, locale: 'en' | 'am'): string`, `__resetSiteConfigCache(): void`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/site-config.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  __resetSiteConfigCache,
  loadSiteConfig,
  localize,
  resolveSiteConfigPath,
  siteConfigSchema,
} from '@/lib/site-config'

const ORIGINAL_SITE_ID = process.env.SITE_ID
const ORIGINAL_PATH = process.env.SITE_CONFIG_PATH

function validConfig() {
  return {
    clinic: {
      name: { en: 'Bright Smile Dental', am: 'ብራይት ስማይል ጥርስ ሕክምና' },
      tagline: { en: 'Gentle care in Bole', am: 'በቦሌ ገር እንክብካቤ' },
    },
    location: {
      region: 'Addis Ababa',
      city: 'Addis Ababa',
      subCity: 'Bole',
      woreda: '03',
      mapEmbedUrl: 'https://www.google.com/maps/embed?pb=test',
    },
    contact: {
      phones: ['+251912345678'],
      email: 'info@brightsmile.et',
    },
    hours: [{ day: { en: 'Monday', am: 'ሰኞ' }, open: '08:30', close: '18:00' }],
    services: [
      { title: { en: 'Cleaning', am: 'ጽዳት' }, copy: { en: 'Gentle scaling.', am: 'ገር ጽዳት።' } },
    ],
    doctors: [
      {
        name: 'Dr Selam Abebe',
        credentials: { en: 'DDS', am: 'DDS' },
        bio: { en: 'Ten years in restorative care.', am: 'አስር ዓመት ልምድ።' },
      },
    ],
    about: {
      story: { en: 'Founded in 2015.', am: 'በ2015 ተመሠረተ።' },
      metrics: [{ value: '20K+', label: { en: 'Patients', am: 'ታካሚዎች' } }],
    },
  }
}

function writeTempConfig(contents: unknown): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'site-config-'))
  const file = path.join(dir, 'clinic.json')
  writeFileSync(file, JSON.stringify(contents), 'utf8')
  return file
}

beforeEach(() => {
  __resetSiteConfigCache()
  delete process.env.SITE_ID
  delete process.env.SITE_CONFIG_PATH
})

afterEach(() => {
  __resetSiteConfigCache()
  if (ORIGINAL_SITE_ID === undefined) delete process.env.SITE_ID
  else process.env.SITE_ID = ORIGINAL_SITE_ID
  if (ORIGINAL_PATH === undefined) delete process.env.SITE_CONFIG_PATH
  else process.env.SITE_CONFIG_PATH = ORIGINAL_PATH
})

describe('resolveSiteConfigPath', () => {
  it('falls back to the default demo clinic when SITE_ID is unset', () => {
    expect(resolveSiteConfigPath()).toBe(
      path.join(process.cwd(), 'config', 'sites', 'default.json')
    )
  })

  it('resolves a named client from SITE_ID', () => {
    process.env.SITE_ID = 'bright-smile'
    expect(resolveSiteConfigPath()).toBe(
      path.join(process.cwd(), 'config', 'sites', 'bright-smile.json')
    )
  })

  it('lets SITE_CONFIG_PATH override SITE_ID for mounted files', () => {
    process.env.SITE_ID = 'bright-smile'
    process.env.SITE_CONFIG_PATH = '/srv/site.json'
    expect(resolveSiteConfigPath()).toBe('/srv/site.json')
  })
})

describe('loadSiteConfig', () => {
  it('loads and validates a well-formed config', () => {
    process.env.SITE_CONFIG_PATH = writeTempConfig(validConfig())
    const config = loadSiteConfig()
    expect(config.clinic.name.am).toBe('ብራይት ስማይል ጥርስ ሕክምና')
    expect(config.location.subCity).toBe('Bole')
  })

  it('loads the committed default config that ships with the repo', () => {
    expect(() => loadSiteConfig()).not.toThrow()
  })

  it('throws and names the path when the file is missing', () => {
    process.env.SITE_CONFIG_PATH = '/nonexistent/site.json'
    expect(() => loadSiteConfig()).toThrow(/\/nonexistent\/site\.json/)
  })

  it('throws and names the failing field when a required field is absent', () => {
    const broken = validConfig()
    // @ts-expect-error deliberately breaking the shape
    delete broken.contact.email
    process.env.SITE_CONFIG_PATH = writeTempConfig(broken)
    expect(() => loadSiteConfig()).toThrow(/contact\.email/)
  })

  it('rejects a phone number that is not E.164 +251', () => {
    const broken = validConfig()
    broken.contact.phones = ['0912345678']
    process.env.SITE_CONFIG_PATH = writeTempConfig(broken)
    expect(() => loadSiteConfig()).toThrow(/contact\.phones/)
  })

  it('rejects a localized field missing its Amharic half', () => {
    const broken = validConfig()
    // @ts-expect-error deliberately breaking the shape
    delete broken.clinic.name.am
    process.env.SITE_CONFIG_PATH = writeTempConfig(broken)
    expect(() => loadSiteConfig()).toThrow(/clinic\.name\.am/)
  })
})

describe('localize', () => {
  it('returns the Amharic string for the am locale', () => {
    expect(localize({ en: 'Home', am: 'መነሻ' }, 'am')).toBe('መነሻ')
  })

  it('returns the English string for the en locale', () => {
    expect(localize({ en: 'Home', am: 'መነሻ' }, 'en')).toBe('Home')
  })

  it('falls back to English when the Amharic string is empty', () => {
    expect(localize({ en: 'Home', am: '' }, 'am')).toBe('Home')
  })
})

describe('siteConfigSchema', () => {
  it('accepts optional fields being absent', () => {
    expect(siteConfigSchema.safeParse(validConfig()).success).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/site-config.test.ts`
Expected: FAIL — cannot resolve `@/lib/site-config`.

- [ ] **Step 3: Write the schema and loader**

Create `lib/site-config.ts`:

```ts
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
```

- [ ] **Step 4: Create the default demo config**

Create `config/sites/default.json`:

```json
{
  "clinic": {
    "name": { "en": "Dentix Dental Clinic", "am": "ዴንቲክስ የጥርስ ክሊኒክ" },
    "tagline": { "en": "Strong teeth, bright smile.", "am": "ጠንካራ ጥርሶች፣ ብሩህ ፈገግታ።" }
  },
  "location": {
    "region": "Addis Ababa",
    "city": "Addis Ababa",
    "subCity": "Bole",
    "woreda": "03",
    "landmark": "Opposite Edna Mall",
    "mapEmbedUrl": "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3940.5!2d38.7869!3d9.0107"
  },
  "contact": {
    "phones": ["+251911234567", "+251911234568"],
    "telegram": "https://t.me/dentixdental",
    "whatsapp": "+251911234567",
    "email": "hello@dentix.et"
  },
  "hours": [
    { "day": { "en": "Monday – Friday", "am": "ሰኞ – ዓርብ" }, "open": "08:30", "close": "18:00" },
    { "day": { "en": "Saturday", "am": "ቅዳሜ" }, "open": "09:00", "close": "16:00" },
    { "day": { "en": "Sunday", "am": "እሁድ" }, "open": "00:00", "close": "00:00" }
  ],
  "services": [
    {
      "title": { "en": "Preventive Care", "am": "የመከላከያ እንክብካቤ" },
      "copy": {
        "en": "Gentle check-ups, modern diagnostics, and a care plan designed around you.",
        "am": "ገር ምርመራዎች፣ ዘመናዊ ምርመራ እና ለእርስዎ የተዘጋጀ የእንክብካቤ ዕቅድ።"
      }
    },
    {
      "title": { "en": "Dental Implants", "am": "የጥርስ ተከላ" },
      "copy": {
        "en": "Natural-looking, long-lasting restorations delivered with clinical precision.",
        "am": "ተፈጥሯዊ የሚመስሉ፣ ዘላቂ ጥገናዎች በክሊኒካዊ ትክክለኛነት።"
      }
    },
    {
      "title": { "en": "Smile Design", "am": "የፈገግታ ንድፍ" },
      "copy": {
        "en": "A personal approach to whitening, alignment, and confident smile transformations.",
        "am": "ለጥርስ ማንጻት፣ ማስተካከል እና በራስ የመተማመን ፈገግታ የግል አቀራረብ።"
      }
    }
  ],
  "doctors": [
    {
      "name": "Dr Selam Abebe",
      "credentials": { "en": "DDS, Restorative Dentistry", "am": "DDS፣ የጥርስ ጥገና ሕክምና" },
      "bio": {
        "en": "Ten years restoring smiles across Addis Ababa, with a focus on unhurried, clearly explained care.",
        "am": "በአዲስ አበባ ለአስር ዓመታት ፈገግታዎችን ሲመልሱ የቆዩ፣ በግልጽ በሚብራራ ያልተጣደፈ እንክብካቤ ላይ ያተኮሩ።"
      }
    },
    {
      "name": "Dr Yonas Tesfaye",
      "credentials": { "en": "DDS, Oral Surgery", "am": "DDS፣ የአፍ ቀዶ ሕክምና" },
      "bio": {
        "en": "Surgical and implant specialist who treats every consultation as a conversation.",
        "am": "እያንዳንዱን ምክክር እንደ ውይይት የሚይዙ የቀዶ ሕክምና እና ተከላ ባለሙያ።"
      }
    }
  ],
  "about": {
    "story": {
      "en": "High-quality dental care tailored to your needs, combining oral health with thoughtful aesthetics.",
      "am": "የአፍ ጤናን ከተመጣጠነ ውበት ጋር በማጣመር ለፍላጎትዎ የተስማማ ከፍተኛ ጥራት ያለው የጥርስ ሕክምና።"
    },
    "metrics": [
      { "value": "20K+", "label": { "en": "Happy patients", "am": "ደስተኛ ታካሚዎች" } },
      { "value": "300+", "label": { "en": "Dental partners", "am": "የጥርስ ሐኪሞች" } },
      { "value": "14K+", "label": { "en": "Successful treatments", "am": "የተሳኩ ሕክምናዎች" } },
      { "value": "98%", "label": { "en": "Patient satisfaction", "am": "የታካሚ እርካታ" } }
    ]
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/site-config.test.ts`
Expected: PASS — 13 tests.

- [ ] **Step 6: Verify types**

Run: `npx tsc --noEmit`
Expected: no new errors.

**Do not commit.**

---

### Task 3: Middleware tier gate

**Files:**

- Create: `middleware.ts`
- Test: `tests/api/tier-gating.test.ts`

**Interfaces:**

- Consumes: `getProductTier()` from Task 1.
- Produces: `isAllowedInLandingTier(pathname: string): boolean`, default-exported `middleware(request: NextRequest)`, exported `config` matcher.

**This task contains a decision left deliberately for the repository owner** — see Step 3.

- [ ] **Step 1: Write the failing test**

Create `tests/api/tier-gating.test.ts`:

```ts
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

  it.each(['/', '/about', '/contact'])('serves the public site path %s', (pathname) => {
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/tier-gating.test.ts`
Expected: FAIL — cannot resolve `@/middleware`.

- [ ] **Step 3: Scaffold the middleware, then hand the allowlist to the repository owner**

Create `middleware.ts` with everything except the allowlist filled in:

```ts
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
 * TODO(owner): decide the policy. Weigh:
 *   - /api/health — uptime monitoring wants it, but a 200 confirms an API layer
 *     exists behind a site that should look purely static.
 *   - /robots.txt, /sitemap.xml — needed for the clinic to rank in search.
 *   - Static asset prefixes the matcher below does not already exclude.
 */
function isAllowed(pathname: string): boolean {
  // IMPLEMENT ME — see TODO above. Return true for permitted paths only.
  throw new Error('LANDING_ALLOWLIST policy not yet implemented')
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
  // cost on every asset request.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets|fonts).*)'],
}
```

**Stop here and ask the repository owner to write `isAllowed`.** It is roughly 8 lines. A reference shape, for them to accept, tighten, or reject:

```ts
const EXACT = new Set(['/', '/about', '/contact'])
const PREFIXES = ['/_next/', '/assets/', '/fonts/']

function isAllowed(pathname: string): boolean {
  if (EXACT.has(pathname)) return true
  return PREFIXES.some((prefix) => pathname.startsWith(prefix))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/tier-gating.test.ts`
Expected: PASS — 21 tests. If `/robots.txt` or `/api/health` were allowlisted in Step 3, add matching assertions to the test file so the policy is pinned by a test.

- [ ] **Step 5: Verify the full suite is unaffected**

Run: `npx vitest run`
Expected: all existing suites still pass. `PRODUCT_TIER` is unset in CI, so the tier resolves to `full` and middleware is a pass-through.

**Do not commit.**

---

### Task 4: Site route group, provider, and chrome

**Files:**

- Create: `components/site/site-provider.tsx`, `components/site/site-header.tsx`, `components/site/site-footer.tsx`, `app/(site)/layout.tsx`
- Move: `app/page.tsx` → `app/(site)/page.tsx`
- Test: `tests/components/site-chrome.test.tsx`

**Interfaces:**

- Consumes: `getProductTier`, `ProductTier` (Task 1); `loadSiteConfig`, `SiteConfig`, `Localized`, `localize` (Task 2).
- Produces: `SiteProvider({ config, tier, children })`, `useSite(): { config: SiteConfig; tier: ProductTier }`, `useLocalize(): (value: Localized) => string`, `<SiteHeader />`, `<SiteFooter />`.

- [ ] **Step 1: Write the failing test**

Create `tests/components/site-chrome.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { LanguageProvider } from '@/lib/i18n'
import { SiteProvider } from '@/components/site/site-provider'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import type { SiteConfig } from '@/lib/site-config'
import type { ProductTier } from '@/lib/product-tier'

const config = {
  clinic: {
    name: { en: 'Dentix Dental Clinic', am: 'ዴንቲክስ የጥርስ ክሊኒክ' },
    tagline: { en: 'Strong teeth, bright smile.', am: 'ጠንካራ ጥርሶች፣ ብሩህ ፈገግታ።' },
  },
  location: {
    region: 'Addis Ababa',
    city: 'Addis Ababa',
    subCity: 'Bole',
    woreda: '03',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=test',
  },
  contact: { phones: ['+251911234567'], email: 'hello@dentix.et' },
  hours: [{ day: { en: 'Monday', am: 'ሰኞ' }, open: '08:30', close: '18:00' }],
  services: [{ title: { en: 'Cleaning', am: 'ጽዳት' }, copy: { en: 'Gentle.', am: 'ገር።' } }],
  doctors: [],
  about: { story: { en: 'Story.', am: 'ታሪክ።' }, metrics: [] },
} as SiteConfig

function renderChrome(tier: ProductTier, node: React.ReactNode) {
  return render(
    <LanguageProvider>
      <SiteProvider config={config} tier={tier}>
        {node}
      </SiteProvider>
    </LanguageProvider>
  )
}

describe('SiteHeader', () => {
  it('shows the clinic name from config, not a hardcoded brand', () => {
    renderChrome('landing', <SiteHeader />)
    expect(screen.getByText('Dentix Dental Clinic')).toBeInTheDocument()
  })

  it('offers the workspace link in full tier', () => {
    renderChrome('full', <SiteHeader />)
    expect(screen.getByRole('link', { name: /open workspace/i })).toHaveAttribute('href', '/login')
  })

  it('hides the workspace link in landing tier', () => {
    renderChrome('landing', <SiteHeader />)
    expect(screen.queryByRole('link', { name: /open workspace/i })).not.toBeInTheDocument()
  })

  it('links to the standalone about and contact pages', () => {
    renderChrome('landing', <SiteHeader />)
    expect(screen.getByRole('link', { name: /about us/i })).toHaveAttribute('href', '/about')
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '/contact')
  })
})

describe('SiteFooter', () => {
  it('hides the workspace link in landing tier', () => {
    renderChrome('landing', <SiteFooter />)
    expect(screen.queryByRole('link', { name: /workspace/i })).not.toBeInTheDocument()
  })

  it('shows the workspace link in full tier', () => {
    renderChrome('full', <SiteFooter />)
    expect(screen.getByRole('link', { name: /workspace/i })).toBeInTheDocument()
  })
})

describe('useSite', () => {
  it('throws outside a SiteProvider so a missing provider fails loudly', () => {
    // Must still be inside LanguageProvider: SiteHeader calls useLanguage()
    // before useSite(), so without it we would assert on the wrong error.
    expect(() =>
      render(
        <LanguageProvider>
          <SiteHeader />
        </LanguageProvider>
      )
    ).toThrow(/SiteProvider/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/site-chrome.test.tsx`
Expected: FAIL — cannot resolve `@/components/site/site-provider`.

- [ ] **Step 3: Write the provider**

Create `components/site/site-provider.tsx`:

```tsx
'use client'

import { createContext, useCallback, useContext } from 'react'

import { useLanguage } from '@/lib/i18n'
import type { ProductTier } from '@/lib/product-tier'
import { localize, type Localized, type SiteConfig } from '@/lib/site-config'

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
```

- [ ] **Step 4: Write the header**

Create `components/site/site-header.tsx`. Lift the header markup from the current `app/page.tsx:57-112`, replacing the hardcoded `Dentix` brand with config and gating the workspace link on tier:

```tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, Stethoscope, X } from 'lucide-react'

import { LanguageSwitcher } from '@/components/language-switcher'
import { useLanguage } from '@/lib/i18n'
import { useLocalize, useSite } from '@/components/site/site-provider'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About us' },
  { href: '/#services', label: 'Services' },
  { href: '/contact', label: 'Contact' },
]

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { t } = useLanguage()
  const { config, tier } = useSite()
  const localize = useLocalize()

  return (
    <header className="absolute left-1/2 top-5 z-20 flex w-[calc(100%-2rem)] max-w-[1260px] -translate-x-1/2 items-center justify-between rounded-full bg-white px-5 py-3 shadow-xl sm:top-8 sm:px-7">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0877ea] text-white">
          <Stethoscope className="h-4 w-4" />
        </span>
        <span className="text-lg">{localize(config.clinic.name)}</span>
      </Link>

      <nav className="hidden items-center gap-9 text-sm text-slate-600 md:flex">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="transition hover:text-[#0877ea]">
            {t(link.label)}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <LanguageSwitcher compact />
        {tier === 'full' && (
          <Link
            href="/login"
            className="hidden rounded-full bg-[#0877ea] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0663c5] md:block"
          >
            {t('Open workspace')}
          </Link>
        )}
        <button
          className="md:hidden"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Toggle navigation"
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {menuOpen && (
        <div className="absolute left-0 right-0 top-full mt-3 rounded-3xl bg-white p-5 shadow-2xl md:hidden">
          <nav className="flex flex-col gap-4 text-sm font-medium">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
                {t(link.label)}
              </Link>
            ))}
            {tier === 'full' && (
              <Link
                href="/login"
                className="rounded-full bg-[#0877ea] px-5 py-3 text-center text-white"
              >
                {t('Open workspace')}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
```

- [ ] **Step 5: Write the footer**

Create `components/site/site-footer.tsx`, from `app/page.tsx:270-280`:

```tsx
'use client'

import Link from 'next/link'

import { useLanguage } from '@/lib/i18n'
import { useLocalize, useSite } from '@/components/site/site-provider'

export function SiteFooter() {
  const { t } = useLanguage()
  const { config, tier } = useSite()
  const localize = useLocalize()

  return (
    <footer className="bg-[#101d30] px-5 py-12 text-white sm:px-10">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-xl font-semibold">{localize(config.clinic.name)}</p>
          <p className="mt-1 text-sm text-white/60">{localize(config.clinic.tagline)}</p>
          <p className="mt-3 text-sm text-white/60">
            {config.location.subCity}, {config.location.city}
          </p>
        </div>
        {tier === 'full' && (
          <Link href="/login" className="rounded-full bg-[#0877ea] px-6 py-3 text-sm font-semibold">
            {t('Open clinic workspace')}
          </Link>
        )}
      </div>
    </footer>
  )
}
```

- [ ] **Step 6: Write the server layout and move the page**

Create `app/(site)/layout.tsx`:

```tsx
import { getProductTier } from '@/lib/product-tier'
import { loadSiteConfig } from '@/lib/site-config'
import { SiteProvider } from '@/components/site/site-provider'
import { SiteFooter } from '@/components/site/site-footer'

// Server component. The only place in the (site) group that touches process.env
// or the filesystem; everything below it is client-side and receives props.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const tier = getProductTier()
  const config = loadSiteConfig()

  return (
    <SiteProvider config={config} tier={tier}>
      {children}
      <SiteFooter />
    </SiteProvider>
  )
}
```

Then move the page: `git mv app/page.tsx "app/(site)/page.tsx"`. The URL is unchanged — route-group parentheses contribute nothing to the path.

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run tests/components/site-chrome.test.tsx`
Expected: PASS — 8 tests.

- [ ] **Step 8: Verify the home page still renders**

Run: `npm run dev` and open `http://localhost:3000/`.
Expected: the page renders with header and footer. The body sections still use hardcoded copy at this point — Task 5 moves them to config.

**Do not commit.**

---

### Task 5: Home page sections driven by config

**Files:**

- Create: `components/site/home-sections.tsx`
- Modify: `app/(site)/page.tsx` (replace the module-level `services`/`metrics` arrays and inline sections)
- Test: `tests/components/site-home.test.tsx`

**Interfaces:**

- Consumes: `useSite`, `useLocalize` (Task 4).
- Produces: `<HeroSection />`, `<AboutSection />`, `<ServicesSection />`, `<DoctorsSection />`.

- [ ] **Step 1: Write the failing test**

Create `tests/components/site-home.test.tsx`. Reuse the `config` fixture shape from Task 4's test, but give it two services, one doctor, and one metric:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { LanguageProvider } from '@/lib/i18n'
import { SiteProvider } from '@/components/site/site-provider'
import {
  AboutSection,
  DoctorsSection,
  HeroSection,
  ServicesSection,
} from '@/components/site/home-sections'
import type { SiteConfig } from '@/lib/site-config'

const config = {
  clinic: {
    name: { en: 'Bright Smile', am: 'ብራይት ስማይል' },
    tagline: { en: 'Care you can feel.', am: 'የሚሰማዎት እንክብካቤ።' },
  },
  location: {
    region: 'Addis Ababa',
    city: 'Addis Ababa',
    subCity: 'Bole',
    woreda: '03',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=test',
  },
  contact: { phones: ['+251911234567'], email: 'hello@brightsmile.et' },
  hours: [{ day: { en: 'Monday', am: 'ሰኞ' }, open: '08:30', close: '18:00' }],
  services: [
    { title: { en: 'Implants', am: 'ተከላ' }, copy: { en: 'Titanium roots.', am: 'የቲታኒየም ሥር።' } },
    { title: { en: 'Whitening', am: 'ማንጻት' }, copy: { en: 'Brighter enamel.', am: 'ብሩህ ኢናሜል።' } },
  ],
  doctors: [
    {
      name: 'Dr Selam Abebe',
      credentials: { en: 'DDS', am: 'DDS' },
      bio: { en: 'Ten years of care.', am: 'አስር ዓመት እንክብካቤ።' },
    },
  ],
  about: {
    story: { en: 'Founded in Bole.', am: 'በቦሌ ተመሠረተ።' },
    metrics: [{ value: '20K+', label: { en: 'Happy patients', am: 'ደስተኛ ታካሚዎች' } }],
  },
} as SiteConfig

function renderSection(node: React.ReactNode) {
  return render(
    <LanguageProvider>
      <SiteProvider config={config} tier="landing">
        {node}
      </SiteProvider>
    </LanguageProvider>
  )
}

describe('HeroSection', () => {
  it('renders the clinic tagline from config', () => {
    renderSection(<HeroSection />)
    expect(screen.getByText('Care you can feel.')).toBeInTheDocument()
  })
})

describe('ServicesSection', () => {
  it('renders one card per configured service', () => {
    renderSection(<ServicesSection />)
    expect(screen.getByText('Implants')).toBeInTheDocument()
    expect(screen.getByText('Whitening')).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })
})

describe('AboutSection', () => {
  it('renders the story and every metric', () => {
    renderSection(<AboutSection />)
    expect(screen.getByText('Founded in Bole.')).toBeInTheDocument()
    expect(screen.getByText('20K+')).toBeInTheDocument()
    expect(screen.getByText('Happy patients')).toBeInTheDocument()
  })
})

describe('DoctorsSection', () => {
  it('renders each configured doctor with credentials', () => {
    renderSection(<DoctorsSection />)
    expect(screen.getByText('Dr Selam Abebe')).toBeInTheDocument()
    expect(screen.getByText('DDS')).toBeInTheDocument()
  })

  it('renders nothing when no doctors are configured', () => {
    const { container } = render(
      <LanguageProvider>
        <SiteProvider config={{ ...config, doctors: [] }} tier="landing">
          <DoctorsSection />
        </SiteProvider>
      </LanguageProvider>
    )
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/site-home.test.tsx`
Expected: FAIL — cannot resolve `@/components/site/home-sections`.

- [ ] **Step 3: Extract the sections from the existing page**

Create `components/site/home-sections.tsx` as a `'use client'` module exporting four components. Move the markup verbatim from `app/(site)/page.tsx` — hero from lines 114-164, about from 168-193, services from 195-230, doctors from 232-268 of the pre-move file — and make these substitutions:

- The module-level `services` array → `config.services`, with `localize(service.title)` and `localize(service.copy)`.
- The module-level `metrics` array → `config.about.metrics`, with `metric.value` and `localize(metric.label)`.
- Hardcoded `t('Strong teeth,')` / `t('bright smile.')` hero heading → `localize(config.clinic.tagline)`.
- Hardcoded `t('High-quality dental care…')` → `localize(config.about.story)`.
- Hardcoded `t('About Dentix')` eyebrow → `` `${t('About')} ${localize(config.clinic.name)}` ``.
- The `Our services` / `Our team` eyebrows and the three `Clear treatment plans` bullet strings stay on `t()` — they are shared chrome, not per-client data.
- The doctors section's hardcoded team image and bullet list is replaced by a card per `config.doctors` entry showing `doctor.name`, `localize(doctor.credentials)`, `localize(doctor.bio)`, and `doctor.photo` when present.
- `DoctorsSection` returns `null` when `config.doctors.length === 0`.
- Keep every existing Tailwind class string exactly as it is. This task changes the data source, not the design.

Each service card keeps its `<article>` element so the test's `getAllByRole('article')` resolves.

- [ ] **Step 4: Rewrite the page to compose the sections**

`app/(site)/page.tsx` becomes:

```tsx
'use client'

import { SiteHeader } from '@/components/site/site-header'
import {
  AboutSection,
  DoctorsSection,
  HeroSection,
  ServicesSection,
} from '@/components/site/home-sections'

export default function HomePage() {
  return (
    <main className="marketing-page min-h-screen bg-[#eef4ff] text-[#101622]">
      <section className="mx-auto max-w-[1480px] px-4 pb-20 pt-4 sm:px-7 lg:px-10">
        <div className="relative min-h-[760px] overflow-hidden rounded-[36px] bg-[#15304d] lg:min-h-[680px] xl:min-h-[700px]">
          <SiteHeader />
          <HeroSection />
        </div>
      </section>
      <AboutSection />
      <ServicesSection />
      <DoctorsSection />
    </main>
  )
}
```

The hero background `<Image>` moves inside `HeroSection`. The footer is supplied by the layout, so it is no longer in the page.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/components/site-home.test.tsx`
Expected: PASS — 5 tests.

- [ ] **Step 6: Verify visually in both languages**

Run: `npm run dev`, open `http://localhost:3000/`, and toggle the language switcher.
Expected: English and Amharic both render from `config/sites/default.json`. Amharic uses Noto Sans Ethiopic (per `CONTEXT.md` invariant 8) with no tofu boxes.

**Do not commit.**

---

### Task 6: About and Contact pages

**Files:**

- Create: `app/(site)/about/page.tsx`, `app/(site)/contact/page.tsx`, `components/site/contact-details.tsx`
- Test: `tests/components/site-contact.test.tsx`

**Interfaces:**

- Consumes: `useSite`, `useLocalize` (Task 4); `AboutSection`, `DoctorsSection` (Task 5).
- Produces: `<ContactDetails />`.

- [ ] **Step 1: Write the failing test**

Create `tests/components/site-contact.test.tsx`, reusing the Task 5 `config` fixture with `telegram` and `whatsapp` added:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { LanguageProvider } from '@/lib/i18n'
import { SiteProvider } from '@/components/site/site-provider'
import { ContactDetails } from '@/components/site/contact-details'
import type { SiteConfig } from '@/lib/site-config'

const config = {
  clinic: {
    name: { en: 'Bright Smile', am: 'ብራይት ስማይል' },
    tagline: { en: 'Care.', am: 'እንክብካቤ።' },
  },
  location: {
    region: 'Addis Ababa',
    city: 'Addis Ababa',
    subCity: 'Bole',
    woreda: '03',
    landmark: 'Opposite Edna Mall',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=test',
  },
  contact: {
    phones: ['+251911234567', '+251911234568'],
    telegram: 'https://t.me/brightsmile',
    whatsapp: '+251911234567',
    email: 'hello@brightsmile.et',
  },
  hours: [
    { day: { en: 'Monday – Friday', am: 'ሰኞ – ዓርብ' }, open: '08:30', close: '18:00' },
    { day: { en: 'Sunday', am: 'እሁድ' }, open: '00:00', close: '00:00' },
  ],
  services: [],
  doctors: [],
  about: { story: { en: 'Story.', am: 'ታሪክ።' }, metrics: [] },
} as unknown as SiteConfig

function renderContact(tier: 'landing' | 'full' = 'landing') {
  return render(
    <LanguageProvider>
      <SiteProvider config={config} tier={tier}>
        <ContactDetails />
      </SiteProvider>
    </LanguageProvider>
  )
}

describe('ContactDetails', () => {
  it('renders every phone number as a tel: link', () => {
    renderContact()
    expect(screen.getByRole('link', { name: '+251911234567' })).toHaveAttribute(
      'href',
      'tel:+251911234567'
    )
    expect(screen.getByRole('link', { name: '+251911234568' })).toHaveAttribute(
      'href',
      'tel:+251911234568'
    )
  })

  it('renders the email as a mailto: link', () => {
    renderContact()
    expect(screen.getByRole('link', { name: 'hello@brightsmile.et' })).toHaveAttribute(
      'href',
      'mailto:hello@brightsmile.et'
    )
  })

  it('renders the Telegram link', () => {
    renderContact()
    expect(screen.getByRole('link', { name: /telegram/i })).toHaveAttribute(
      'href',
      'https://t.me/brightsmile'
    )
  })

  it('builds a wa.me link from the WhatsApp number without the plus sign', () => {
    renderContact()
    expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute(
      'href',
      'https://wa.me/251911234567'
    )
  })

  it('renders the full Ethiopian address including sub-city and woreda', () => {
    renderContact()
    expect(screen.getByText(/Bole/)).toBeInTheDocument()
    expect(screen.getByText(/Woreda 03/)).toBeInTheDocument()
    expect(screen.getByText(/Opposite Edna Mall/)).toBeInTheDocument()
  })

  it('embeds the map', () => {
    renderContact()
    expect(screen.getByTitle(/map/i)).toHaveAttribute(
      'src',
      'https://www.google.com/maps/embed?pb=test'
    )
  })

  it('renders opening hours, showing Closed for a 00:00–00:00 day', () => {
    renderContact()
    expect(screen.getByText('Monday – Friday')).toBeInTheDocument()
    expect(screen.getByText('08:30 – 18:00')).toBeInTheDocument()
    expect(screen.getByText(/closed/i)).toBeInTheDocument()
  })

  it('does not offer online booking in landing tier', () => {
    renderContact('landing')
    expect(screen.queryByRole('link', { name: /book online/i })).not.toBeInTheDocument()
  })

  it('offers online booking through the patient portal in full tier', () => {
    renderContact('full')
    expect(screen.getByRole('link', { name: /book online/i })).toHaveAttribute(
      'href',
      '/portal/book'
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/site-contact.test.tsx`
Expected: FAIL — cannot resolve `@/components/site/contact-details`.

- [ ] **Step 3: Write ContactDetails**

Create `components/site/contact-details.tsx` as a `'use client'` component. Requirements the tests pin:

- One `tel:` link per `config.contact.phones` entry, link text being the number itself.
- A `mailto:` link for `config.contact.email`, link text being the address.
- Telegram link rendered only when `config.contact.telegram` is set; accessible name contains "Telegram".
- WhatsApp link only when `config.contact.whatsapp` is set, `href` built as `` `https://wa.me/${whatsapp.replace('+', '')}` ``; accessible name contains "WhatsApp".
- Address block reading `` `${subCity}, Woreda ${woreda}` ``, then `city`, then `kebele` and `landmark` when present.
- An `<iframe title="Clinic location map" src={config.location.mapEmbedUrl} loading="lazy" />` inside a rounded container.
- An hours list: for each entry, `localize(day)` and either `Closed` (when `open === '00:00' && close === '00:00'`) or `` `${open} – ${close}` `` using an en dash.
- When `tier === 'full'`, a "Book online" link to `/portal/book`. Never in landing tier.
- **No form and no POST endpoint.** Landing tier is a static site by design.

Match the visual language of the existing sections: `rounded-[28px]`, `bg-white`, `p-7`, `shadow-sm`, `#0877ea` accent.

- [ ] **Step 4: Write the two pages**

`app/(site)/contact/page.tsx`:

```tsx
'use client'

import { SiteHeader } from '@/components/site/site-header'
import { ContactDetails } from '@/components/site/contact-details'
import { useLanguage } from '@/lib/i18n'

export default function ContactPage() {
  const { t } = useLanguage()
  return (
    <main className="marketing-page min-h-screen bg-[#eef4ff] text-[#101622]">
      <section className="mx-auto max-w-[1480px] px-4 pb-20 pt-4 sm:px-7 lg:px-10">
        <div className="relative min-h-[220px] overflow-hidden rounded-[36px] bg-[#15304d]">
          <SiteHeader />
        </div>
      </section>
      <section className="px-5 pb-24 sm:px-10">
        <div className="mx-auto max-w-7xl">
          <h1 className="mb-10 text-5xl font-medium tracking-[-.05em] sm:text-6xl">
            {t('Contact us')}
          </h1>
          <ContactDetails />
        </div>
      </section>
    </main>
  )
}
```

`app/(site)/about/page.tsx` follows the same shell, with an `<h1>{t('About us')}</h1>` followed by `<AboutSection />` and `<DoctorsSection />` from Task 5.

- [ ] **Step 5: Add the new UI strings to the Amharic dictionary**

Add to the `amharic` record in `lib/i18n.tsx` (it already contains `'About us'`):

```ts
  Contact: 'አግኙን',
  'Contact us': 'አግኙን',
  'Opening hours': 'የስራ ሰዓታት',
  Closed: 'ዝግ',
  'Find us': 'የት እንደምንገኝ',
  'Book online': 'በመስመር ላይ ይያዙ',
  'Open clinic workspace': 'የክሊኒክ የስራ ቦታ ይክፈቱ',
  About: 'ስለ',
  Telegram: 'ቴሌግራም',
  WhatsApp: 'ዋትስአፕ',
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/components/site-contact.test.tsx`
Expected: PASS — 9 tests.

- [ ] **Step 7: Verify both pages render**

Run: `npm run dev`, then open `/about` and `/contact`.
Expected: both render, header links navigate between all three pages, map embed loads.

**Do not commit.**

---

### Task 7: Navigation filtering and full-tier wiring

**Files:**

- Modify: `config/nav.ts` (append a tier filter alongside the existing role filter)
- Test: `tests/unit/nav-config.test.ts` (existing file — add cases, do not rewrite)

**Interfaces:**

- Consumes: `ProductTier` (Task 1), `navigation`, `NavSection`, `getNavigationForRole` (existing).
- Produces: `getNavigationForTier(role: string, tier: ProductTier): NavSection[]`.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/nav-config.test.ts`:

```ts
describe('getNavigationForTier', () => {
  it('returns the full role-filtered navigation in full tier', () => {
    const forRole = getNavigationForRole('ADMIN')
    expect(getNavigationForTier('ADMIN', 'full')).toEqual(forRole)
  })

  it('returns no ERP navigation at all in landing tier', () => {
    expect(getNavigationForTier('ADMIN', 'landing')).toEqual([])
  })

  it('returns no navigation in landing tier regardless of role', () => {
    expect(getNavigationForTier('DOCTOR', 'landing')).toEqual([])
    expect(getNavigationForTier('RECEPTIONIST', 'landing')).toEqual([])
  })
})
```

Add `getNavigationForTier` to the file's existing import from `@/config/nav`, and `describe`/`it`/`expect` are global — do not import them.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/nav-config.test.ts`
Expected: FAIL — `getNavigationForTier is not a function`.

- [ ] **Step 3: Implement the filter**

Append to `config/nav.ts`:

```ts
import type { ProductTier } from '@/lib/product-tier'

/**
 * Navigation for a role within a tier.
 *
 * Presentation only. The landing tier's actual enforcement is middleware.ts,
 * which 404s these routes whether or not they appear in a menu.
 */
export function getNavigationForTier(role: string, tier: ProductTier): NavSection[] {
  if (tier === 'landing') return []
  return getNavigationForRole(role)
}
```

Every entry in `navigation` is an ERP destination, so landing tier returns an empty array rather than filtering item by item.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/nav-config.test.ts`
Expected: PASS — existing cases plus 3 new ones.

- [ ] **Step 5: Verify the whole suite**

Run: `npx vitest run`
Expected: every suite green.

**Do not commit.**

---

### Task 8: Delivery artifacts

**Files:**

- Create: `docker-compose.landing.yml`, `.env.landing.example`, `docs/DELIVERY.md`
- Modify: `Dockerfile` (copy `config/` into the runner stage), `docker-compose.yml`, `docker-compose.dev.yml`, `.env.example`
- Test: `tests/deployment/deployment-config.test.ts` (existing file — add cases)

**Interfaces:**

- Consumes: `PRODUCT_TIER`, `SITE_ID`, `SITE_CONFIG_PATH` conventions from Tasks 1 and 2.
- Produces: no code interface. Deployment artifacts only.

- [ ] **Step 1: Write the failing test**

Append to `tests/deployment/deployment-config.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'

function readRepoFile(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), 'utf8')
}

describe('landing tier delivery artifacts', () => {
  it('ships a landing compose file that sets the tier explicitly', () => {
    expect(readRepoFile('docker-compose.landing.yml')).toMatch(/PRODUCT_TIER:\s*landing/)
  })

  it('runs no database, cache, or backend in the landing stack', () => {
    const compose = readRepoFile('docker-compose.landing.yml')
    // Assert on declared service names, not on word occurrences anywhere in
    // the file — the file's own comments legitimately mention what it omits.
    const serviceNames = compose
      .split('\n')
      .filter((line) => /^ {2}\w[\w-]*:$/.test(line))
      .map((line) => line.trim().replace(':', ''))
    expect(serviceNames).toEqual(['app'])
  })

  it('sets the tier explicitly in the full-suite compose files', () => {
    expect(readRepoFile('docker-compose.yml')).toMatch(/PRODUCT_TIER/)
    expect(readRepoFile('docker-compose.dev.yml')).toMatch(/PRODUCT_TIER/)
  })

  it('copies config/ into the standalone runner so SITE_ID resolves at runtime', () => {
    // Next traces static imports only. loadSiteConfig reads a dynamic path, so
    // without this COPY the image starts and then fails on the first request.
    expect(readRepoFile('Dockerfile')).toMatch(/COPY --from=builder \/app\/config \.\/config/)
  })

  it('documents both tiers in the env template', () => {
    const env = readRepoFile('.env.example')
    expect(env).toMatch(/PRODUCT_TIER/)
    expect(env).toMatch(/SITE_ID/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/deployment/deployment-config.test.ts`
Expected: FAIL — `docker-compose.landing.yml` does not exist.

- [ ] **Step 3: Fix the Dockerfile tracing gap**

In `Dockerfile`, in the **runner** stage next to the existing `COPY --from=builder /app/public ./public`, add:

```dockerfile
# Site configs are read at runtime by path (SITE_ID / SITE_CONFIG_PATH), so
# Next's standalone tracing — which follows static imports only — never sees
# them. Without this the image builds fine and 500s on the first page load.
COPY --from=builder /app/config ./config
```

- [ ] **Step 4: Write the landing compose file**

Create `docker-compose.landing.yml`:

```yaml
# Landing tier: a clinic website and nothing else.
# No database, no cache, no FastAPI backend — the site is entirely static
# content rendered from a committed JSON config.
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      PRODUCT_TIER: landing
      SITE_ID: ${SITE_ID:-default}
      NODE_ENV: production
    ports:
      - '${LANDING_PORT:-3000}:3000'
    healthcheck:
      # The site root, not /api/health — the landing tier has no API surface.
      test: ['CMD', 'wget', '--spider', '-q', 'http://localhost:3000/']
      interval: 30s
      timeout: 5s
      retries: 3
```

- [ ] **Step 5: Write the env template**

Create `.env.landing.example`:

```bash
# Landing tier — clinic website only.
# Copy to .env and deploy with: docker compose -f docker-compose.landing.yml up -d

# Must be exactly "landing". Any other spelling fails at startup by design.
PRODUCT_TIER=landing

# Selects config/sites/<SITE_ID>.json.
SITE_ID=default

# Optional: absolute path to a mounted config, overriding SITE_ID.
# SITE_CONFIG_PATH=/srv/clinic-site.json

LANDING_PORT=3000
```

Append to `.env.example`:

```bash
# Product tier: "full" (website + ERP) or "landing" (website only).
# Defaults to "full" when unset.
PRODUCT_TIER=full

# Selects the per-client website content at config/sites/<SITE_ID>.json.
SITE_ID=default
```

Add `PRODUCT_TIER: ${PRODUCT_TIER:-full}` and `SITE_ID: ${SITE_ID:-default}` to the `app` service environment in both `docker-compose.yml` and `docker-compose.dev.yml`.

- [ ] **Step 6: Write the delivery guide**

Create `docs/DELIVERY.md` covering, with copy-pasteable commands:

1. **Onboarding a client** — copy `config/sites/default.json` to `config/sites/<client-slug>.json`, fill in both language halves of every localized field, get the Google Maps embed URL, and validate by running `SITE_ID=<client-slug> npx vitest run tests/unit/site-config.test.ts`.
2. **Landing handoff** — `cp .env.landing.example .env`, set `SITE_ID`, `docker compose -f docker-compose.landing.yml up -d`. One container. Note that content changes require a redeploy, and that this is the tier without a CMS.
3. **Full-suite handoff** — the existing `docker-compose.yml` procedure with `PRODUCT_TIER=full`.
4. **Upgrade path, landing → full** — switch `PRODUCT_TIER` to `full`, bring up Postgres and the FastAPI backend, run migrations, seed the clinic. The site content keeps rendering from the same JSON until the CMS ships.
5. **The source-presence caveat**, verbatim from the spec: a landing client's server holds ERP source that is unreachable but not absent.

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run tests/deployment/deployment-config.test.ts`
Expected: PASS.

- [ ] **Step 8: Verify a real landing build end to end**

```bash
docker compose -f docker-compose.landing.yml up --build -d
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/          # expect 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/about     # expect 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/contact   # expect 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/dashboard # expect 404
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/login     # expect 404
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/patients # expect 404
docker compose -f docker-compose.landing.yml down
```

Expected: exactly the status codes annotated above. This is the acceptance test for the whole plan — if `/dashboard` returns anything other than 404, the product is not safe to sell as a landing-only deployment.

- [ ] **Step 9: Full verification**

```bash
npx vitest run
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all green. Then report results to the user; **do not commit**.

---

## Self-Review

**Spec coverage:**

| Spec section                                                          | Task                          |
| --------------------------------------------------------------------- | ----------------------------- |
| Tier resolution, default-to-full, no `NEXT_PUBLIC_`                   | 1                             |
| Site config schema, loader, zod validation, `SITE_CONFIG_PATH`        | 2                             |
| Hard gate middleware, 404, allowlist as owner decision                | 3                             |
| Site route group, server/client boundary, `SiteProvider`              | 4                             |
| Page decomposition into `components/site/`                            | 4, 5                          |
| About + contact pages, location, hours, direct contact links, no form | 6                             |
| Soft gate — nav filtering                                             | 7                             |
| Full-tier additions: workspace link, `/portal/book`                   | 4, 6                          |
| Delivery artifacts, compose, env templates, `docs/DELIVERY.md`        | 8                             |
| Error-handling table                                                  | 1 (tier), 2 (config), 3 (404) |
| Testing section                                                       | every task                    |

No gaps.

**Type consistency:** `Localized`, `SiteConfig`, `ProductTier` are defined in Tasks 1–2 and used with identical names in Tasks 3–8. `localize(value, locale)` is the module function; `useLocalize()` returns the bound single-argument form — both names appear consistently. `getNavigationForTier(role, tier)` matches between Task 7's test and implementation.

**Deviation from the writing-plans skill:** commit steps are replaced by verification steps throughout, per the user's explicit instruction. This is recorded in Global Constraints.

## Known gap, deliberately left open

Task 3 Step 3 ships `middleware.ts` with `isAllowed` throwing. **The plan does not run green until the repository owner writes that function.** This is intentional — the allowlist decides what a landing client's server exposes to the public internet, and the reference implementation in Step 3 is a starting point to accept or tighten, not a default to adopt silently.
