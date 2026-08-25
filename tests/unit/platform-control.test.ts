import { afterEach, describe, expect, it } from 'vitest'
import {
  customerSchema,
  installationSchema,
  isWorkerRequestAuthorized,
  normalizedFeatures,
  platformOperationSchema,
} from '@/lib/platform-validation'

const originalToken = process.env.PLATFORM_WORKER_TOKEN

afterEach(() => {
  if (originalToken === undefined) delete process.env.PLATFORM_WORKER_TOKEN
  else process.env.PLATFORM_WORKER_TOKEN = originalToken
})

describe('platform control-plane validation', () => {
  it('accepts safe customer and installation identifiers', () => {
    expect(customerSchema.parse({ name: 'Abeba Dental', slug: 'abeba-dental' }).slug).toBe(
      'abeba-dental'
    )
    expect(
      installationSchema.parse({
        customerId: 'customer-1',
        productId: 'product-1',
        name: 'Production',
        slug: 'abeba-production',
        hostname: 'abeba.dental-clinic-cms.duckdns.org',
        version: '1.2.3',
      }).hostname
    ).toBe('abeba.dental-clinic-cms.duckdns.org')
  })

  it.each(['../escape', 'UPPERCASE', 'has spaces', '/opt/clinic'])(
    'rejects unsafe slugs: %s',
    (slug) => {
      expect(() => customerSchema.parse({ name: 'Clinic', slug })).toThrow()
    }
  )

  it.each(['localhost', '127.0.0.1', 'http://clinic.example.com', 'bad_host.example.com'])(
    'rejects unsafe hostnames: %s',
    (hostname) => {
      expect(() =>
        installationSchema.parse({
          customerId: 'c1',
          productId: 'p1',
          name: 'Production',
          slug: 'production',
          hostname,
          version: '1.2.3',
        })
      ).toThrow()
    }
  )

  it('allows only the worker operation vocabulary', () => {
    expect(platformOperationSchema.parse('BACKUP')).toBe('BACKUP')
    expect(() => platformOperationSchema.parse('RUN_ARBITRARY_COMMAND')).toThrow()
  })

  it('requires an exact release version for reproducible deployments', () => {
    expect(() =>
      installationSchema.parse({
        customerId: 'c1',
        productId: 'p1',
        name: 'Production',
        slug: 'production',
        hostname: 'clinic.example.com',
        version: '',
      })
    ).toThrow()
  })

  it('authorizes a worker token exactly and fails closed when unset', () => {
    delete process.env.PLATFORM_WORKER_TOKEN
    expect(isWorkerRequestAuthorized('Bearer anything')).toBe(false)
    process.env.PLATFORM_WORKER_TOKEN = 'a'.repeat(48)
    expect(isWorkerRequestAuthorized(`Bearer ${'a'.repeat(48)}`)).toBe(true)
    expect(isWorkerRequestAuthorized(`Bearer ${'b'.repeat(48)}`)).toBe(false)
  })

  it('drops non-boolean feature values', () => {
    expect(normalizedFeatures({ handwrittenDiagnosis: true, injected: 'true', count: 1 })).toEqual({
      handwrittenDiagnosis: true,
    })
  })
})
