import { describe, expect, it } from 'vitest'
import { amharic, translateText } from '@/lib/i18n'

describe('Amharic translation catalogue', () => {
  const coreWorkflowLabels = [
    'Patients',
    'Appointments',
    'Assessment & Treatment',
    'Billing & Payments',
    'Dental Laboratory',
    'Reports',
    'Accounting & Finance',
    'Register patient',
    'New appointment',
    'Invoices',
    'Payments',
    'Dentist commissions',
  ]

  it.each(coreWorkflowLabels)('provides Ethiopic text for %s', (label) => {
    const translated = translateText(label, 'am')
    expect(translated).not.toBe(label)
    expect(translated).toMatch(/[\u1200-\u137f]/)
  })

  it('preserves English and safely falls back for untranslated copy', () => {
    expect(translateText('Patients', 'en')).toBe('Patients')
    expect(translateText('Uncatalogued text', 'am')).toBe('Uncatalogued text')
  })

  it('covers a substantial shared ERP vocabulary', () => {
    expect(Object.keys(amharic).length).toBeGreaterThanOrEqual(300)
  })
})
