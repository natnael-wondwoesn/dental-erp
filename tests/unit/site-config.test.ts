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
