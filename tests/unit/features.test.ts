import { afterEach, describe, expect, it } from 'vitest'
import { getPublicFeatureEntitlements, isFeatureEnabled } from '@/lib/features'

const original = process.env.FEATURE_HANDWRITTEN_DIAGNOSIS

afterEach(() => {
  if (original === undefined) delete process.env.FEATURE_HANDWRITTEN_DIAGNOSIS
  else process.env.FEATURE_HANDWRITTEN_DIAGNOSIS = original
})

describe('product feature entitlements', () => {
  it('keeps handwriting disabled for existing clinics by default', () => {
    delete process.env.FEATURE_HANDWRITTEN_DIAGNOSIS
    expect(isFeatureEnabled('handwrittenDiagnosis')).toBe(false)
  })

  it.each(['1', 'true', 'TRUE', 'yes', 'on'])('enables handwriting for %s', (value) => {
    process.env.FEATURE_HANDWRITTEN_DIAGNOSIS = value
    expect(getPublicFeatureEntitlements().handwrittenDiagnosis).toBe(true)
  })

  it('fails closed for an unrecognized value', () => {
    process.env.FEATURE_HANDWRITTEN_DIAGNOSIS = 'enabled'
    expect(isFeatureEnabled('handwrittenDiagnosis')).toBe(false)
  })
})
