// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  catalogFor,
  moduleIdsFor,
  starterFor,
  validateModulesFor,
} from '@/lib/saas/product-catalogs'

describe('owner-console product catalogs', () => {
  it('serves each product its own module set', () => {
    expect(moduleIdsFor('dental-erp')).toContain('braces')
    expect(moduleIdsFor('dental-erp')).not.toContain('treatment_plans')
    expect(moduleIdsFor('clinic-cms')).toContain('treatment_plans')
    expect(moduleIdsFor('clinic-cms')).not.toContain('braces')
  })

  it('defaults unknown products to dental', () => {
    expect(moduleIdsFor(undefined)).toEqual(moduleIdsFor('dental-erp'))
    expect(moduleIdsFor('mystery')).toEqual(moduleIdsFor('dental-erp'))
  })

  it('enforces dependencies per product', () => {
    expect(() => validateModulesFor('clinic-cms', ['core', 'patients', 'treatment_plans'])).toThrow(
      'assessments'
    )
    expect(validateModulesFor('clinic-cms', starterFor('clinic-cms'))).toContain('treatment_plans')
  })

  it('rejects a module that belongs to another product', () => {
    expect(() => validateModulesFor('clinic-cms', ['core', 'braces'])).toThrow('Unknown module')
    expect(() => validateModulesFor('dental-erp', ['core', 'assessments'])).toThrow(
      'Unknown module'
    )
  })

  it('requires core', () => {
    expect(() => validateModulesFor('clinic-cms', ['patients'])).toThrow('Core module is required')
    expect(catalogFor('clinic-cms').core).toEqual([])
  })
})
