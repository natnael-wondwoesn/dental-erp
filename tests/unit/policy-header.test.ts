import { describe, expect, it } from 'vitest'
import { serializePolicyHeader } from '@/lib/saas/policy-header'

describe('serializePolicyHeader', () => {
  it('produces a Latin-1-safe value that round-trips Amharic text', () => {
    const policy = { tenantId: 't', branding: { nameAm: 'ቢቲ ፋና', name: 'Café' } }
    const value = serializePolicyHeader(policy)
    expect(/^[\x20-\x7e]*$/.test(value)).toBe(true)
    expect(() => new Headers({ 'x-test': value })).not.toThrow()
    expect(JSON.parse(value)).toEqual(policy)
  })
})
