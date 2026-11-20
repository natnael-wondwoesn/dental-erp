// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/licensing/license-runtime', () => ({ getLicenseRuntime: vi.fn() }))

import {
  eligibleTenantIds,
  loadSaaSAccess,
  localModules,
  saasEnforcement,
  assertModuleWrite,
} from '@/lib/saas/server'
import { accessDenial, moduleIds } from '@/lib/saas/catalog'

const original = { mode: process.env.SAAS_ENFORCEMENT, modules: process.env.SAAS_MODULES }

afterEach(() => {
  if (original.mode === undefined) delete process.env.SAAS_ENFORCEMENT
  else process.env.SAAS_ENFORCEMENT = original.mode
  if (original.modules === undefined) delete process.env.SAAS_MODULES
  else process.env.SAAS_MODULES = original.modules
})

function local(modules?: string) {
  process.env.SAAS_ENFORCEMENT = 'local'
  if (modules === undefined) delete process.env.SAAS_MODULES
  else process.env.SAAS_MODULES = modules
}

describe('local module control (SAAS_ENFORCEMENT=local)', () => {
  it('is an accepted mode', () => {
    local()
    expect(saasEnforcement()).toBe('local')
  })

  it('turns every module on when the list is empty, unset or "all"', () => {
    for (const value of [undefined, '', '  ', 'all', 'ALL']) {
      local(value)
      expect(localModules()).toEqual(moduleIds)
    }
  })

  it('uses exactly the listed modules, sorted', async () => {
    local('patients, core ,appointments')
    const access = await loadSaaSAccess('clinic-1')
    expect(access.modules).toEqual(['appointments', 'core', 'patients'])
    expect(access.allowsWrite).toBe(true)
    expect(access.state).toBe('active')
  })

  it('refuses an invalid list instead of guessing', () => {
    local('core,appointments') // appointments needs patients
    expect(() => localModules()).toThrow(/requires patients/)
    local('patients') // core missing
    expect(() => localModules()).toThrow(/Core module is required/)
    local('core,nonsense')
    expect(() => localModules()).toThrow(/Unknown module/)
  })

  it('blocks routes of switched-off modules and allows the rest', async () => {
    local('core,patients,appointments,clinical,billing')
    const access = await loadSaaSAccess('clinic-1')
    expect(accessDenial(access, '/api/lab-orders', 'GET')).toEqual({
      status: 403,
      code: 'MODULE_NOT_ENABLED',
    })
    expect(accessDenial(access, '/api/patients', 'GET')).toBeNull()
    expect(accessDenial(access, '/api/invoices', 'POST')).toBeNull()
  })

  it('rejects writes for a switched-off module and allows enabled ones', async () => {
    local('core,patients')
    await expect(assertModuleWrite('clinic-1', ['patients'])).resolves.toBeUndefined()
    await expect(assertModuleWrite('clinic-1', ['billing'])).rejects.toThrow(/module/i)
  })

  it('keeps background jobs off for modules that are switched off', async () => {
    local('core,patients')
    expect(await eligibleTenantIds(['patients'])).toBeUndefined()
    expect(await eligibleTenantIds(['billing'])).toEqual([])
  })
})
