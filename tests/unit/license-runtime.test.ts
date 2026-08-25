import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { evaluateApiLicenseGate } from '@/lib/licensing/api-gate'
import { LicenseRuntime, type LicenseMaterialStore } from '@/lib/licensing/license-runtime'
import type { LicenseEvidence } from '@/lib/licensing/license-decision'

const vector = JSON.parse(
  readFileSync(path.join(process.cwd(), 'docs/licensing/test-vectors/v1-valid.json'), 'utf8')
)

class MemoryStore implements LicenseMaterialStore {
  license = JSON.stringify(vector.license)
  installationId = 'installation-test-01'
  evidence: LicenseEvidence = {}
  writes = 0

  async readLicense() {
    return this.license
  }

  async readInstallationId() {
    return this.installationId
  }

  async readEvidence() {
    return this.evidence
  }

  async writeLicense(value: string) {
    this.license = value
  }

  async writeEvidence(value: LicenseEvidence) {
    this.writes += 1
    this.evidence = value
  }
}

function runtime(enforcement: 'disabled' | 'audit' | 'required', store = new MemoryStore()) {
  return new LicenseRuntime({
    enforcement,
    productId: 'dental-erp',
    store,
    publicKeys: { 'test-2026-01': vector.public_key_pem },
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('Next.js license runtime', () => {
  it('persists evidence after a valid decision', async () => {
    const store = new MemoryStore()
    const decision = await runtime('required', store).decide(new Date('2026-08-20T12:00:00Z'))
    expect(decision.state).toBe('active')
    expect(store.evidence.highest_sequence).toBe(1)
    expect(store.writes).toBe(1)
  })

  it('keeps reads but denies writes after the five-day grace period', async () => {
    const decision = await runtime('required').decide(new Date('2026-09-06T00:00:00Z'))
    expect(decision.state).toBe('expired_read_only')
    expect(decision.allows_read).toBe(true)
    expect(decision.allows_write).toBe(false)
  })

  it('disabled mode does not touch installation state', async () => {
    const store = new MemoryStore()
    store.readInstallationId = async () => {
      throw new Error('must not read')
    }
    expect((await runtime('disabled', store).decide()).allows_write).toBe(true)
  })

  it('rejects an expired license import without replacing the current license', async () => {
    const store = new MemoryStore()
    const before = store.license
    await expect(
      runtime('required', store).importLicense(before, new Date('2026-09-06T00:00:00Z'))
    ).rejects.toThrow('expired')
    expect(store.license).toBe(before)
  })
})

describe('legacy Next.js API license gate', () => {
  it('allows safe reads after expiry', async () => {
    vi.stubEnv('LICENSE_ENFORCEMENT', 'required')
    expect(await evaluateApiLicenseGate('GET', runtime('required'))).toBeNull()
  })

  it('blocks unsafe writes and fails closed when the method marker is missing', async () => {
    vi.stubEnv('LICENSE_ENFORCEMENT', 'required')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-06T00:00:00Z'))
    const expired = runtime('required')
    expect((await evaluateApiLicenseGate('POST', expired))?.state).toBe('expired_read_only')

    const missingMarker = runtime('required')
    expect((await evaluateApiLicenseGate(null, missingMarker))?.allows_write).toBe(false)
  })

  it('audit mode evaluates but does not block', async () => {
    vi.stubEnv('LICENSE_ENFORCEMENT', 'audit')
    expect(await evaluateApiLicenseGate('POST', runtime('audit'))).toBeNull()
  })
})
