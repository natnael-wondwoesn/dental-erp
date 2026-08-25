import { createPrivateKey, createPublicKey, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  LICENSE_FORMAT,
  LICENSE_TYPE,
  evaluateLicense,
  type LicensePayload,
} from '@/lib/licensing/license-decision'

const TEST_SEED = Buffer.from(
  '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
  'hex'
)
const TEST_PRIVATE_KEY = createPrivateKey({
  key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), TEST_SEED]),
  format: 'der',
  type: 'pkcs8',
})
const TEST_PUBLIC_KEY = createPublicKey(TEST_PRIVATE_KEY)
  .export({ format: 'pem', type: 'spki' })
  .toString()

const payload: LicensePayload = {
  schema_version: 1,
  license_id: '018f47a7-5b9c-7d31-8e1a-c7c77d79f401',
  customer_id: 'customer-sunny-smile',
  product_id: 'dental-erp',
  installation_id: 'installation-test-01',
  sequence: 1,
  issued_at: '2026-08-01T00:00:00Z',
  not_before: '2026-08-01T00:00:00Z',
  expires_at: '2026-08-31T23:59:59Z',
  mode: 'standard',
  grace_days: 5,
  entitlements: ['core'],
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function license(overrides: Partial<LicensePayload> = {}): string {
  const protectedValue = encode({ alg: 'EdDSA', kid: 'test-2026-01', typ: LICENSE_TYPE })
  const payloadValue = encode({ ...payload, ...overrides })
  const signature = sign(
    null,
    Buffer.from(`${protectedValue}.${payloadValue}`, 'ascii'),
    TEST_PRIVATE_KEY
  ).toString('base64url')
  return JSON.stringify({
    format: LICENSE_FORMAT,
    protected: protectedValue,
    payload: payloadValue,
    signature,
  })
}

function evaluate(at: string, overrides: Partial<Parameters<typeof evaluateLicense>[0]> = {}) {
  return evaluateLicense({
    license: license(),
    product_id: 'dental-erp',
    installation_id: 'installation-test-01',
    public_keys: { 'test-2026-01': TEST_PUBLIC_KEY },
    now: new Date(at),
    ...overrides,
  })
}

describe('offline license decisions', () => {
  it('verifies the shared cross-language golden vector', () => {
    const vector = JSON.parse(
      readFileSync(path.join(process.cwd(), 'docs/licensing/test-vectors/v1-valid.json'), 'utf8')
    )
    const decision = evaluateLicense({
      license: vector.license,
      product_id: 'dental-erp',
      installation_id: 'installation-test-01',
      public_keys: { 'test-2026-01': vector.public_key_pem },
      now: new Date('2026-08-20T12:00:00Z'),
    })
    expect(decision.state).toBe('active')
  })

  it('allows writes while a valid license is active', () => {
    const decision = evaluate('2026-08-20T12:00:00Z')
    expect(decision.state).toBe('active')
    expect(decision.allows_write).toBe(true)
    expect(decision.next_evidence.highest_sequence).toBe(1)
  })

  it('allows writes for exactly five days of grace', () => {
    expect(evaluate('2026-09-05T23:59:59Z').state).toBe('grace')
    const expired = evaluate('2026-09-06T00:00:00Z')
    expect(expired.state).toBe('expired_read_only')
    expect(expired.allows_read).toBe(true)
    expect(expired.allows_write).toBe(false)
    expect(expired.allows_recovery).toBe(true)
  })

  it('rejects a license copied to another installation', () => {
    expect(evaluate('2026-08-20T12:00:00Z', { installation_id: 'installation-other' }).reason).toBe(
      'wrong_installation'
    )
  })

  it('accepts RFC 7638 thumbprints beginning with a base64url symbol', () => {
    const installationId = '-d1wGF_MqzyJJo0Amupuq94VtA-5hnOpYu1IwBPXFmk'
    const decision = evaluate('2026-08-20T12:00:00Z', {
      license: license({ installation_id: installationId }),
      installation_id: installationId,
    })
    expect(decision.state).toBe('active')
  })

  it('rejects a license issued for another product', () => {
    const decision = evaluate('2026-08-20T12:00:00Z', {
      product_id: 'clinic-cms',
      evidence: { highest_sequence: 0 },
    })
    expect(decision.reason).toBe('wrong_product')
    expect(decision.next_evidence.highest_sequence).toBe(0)
  })

  it('rejects payload tampering', () => {
    const parsed = JSON.parse(license())
    parsed.payload = encode({ ...payload, expires_at: '2036-08-31T23:59:59Z' })
    expect(evaluate('2026-08-20T12:00:00Z', { license: JSON.stringify(parsed) }).reason).toBe(
      'invalid_signature'
    )
  })

  it('detects ordinary clock rollback', () => {
    const decision = evaluate('2026-08-20T12:00:00Z', {
      evidence: { max_observed_at: '2026-08-21T12:00:00Z' },
    })
    expect(decision.reason).toBe('clock_rollback')
    expect(decision.allows_write).toBe(false)
  })

  it('rejects replay of an older license sequence', () => {
    const decision = evaluate('2026-08-20T12:00:00Z', {
      evidence: {
        highest_sequence: 2,
        highest_sequence_license_id: '018f47a7-5b9c-7d31-8e1a-c7c77d79f402',
      },
    })
    expect(decision.reason).toBe('superseded_license')
  })

  it('rejects a standard license whose grace policy is not five days', () => {
    expect(evaluate('2026-08-20T12:00:00Z', { license: license({ grace_days: 6 }) }).reason).toBe(
      'malformed'
    )
  })

  it('allows a valid emergency license only until its own expiry', () => {
    const emergency = license({
      issued_at: '2026-08-20T00:00:00Z',
      not_before: '2026-08-20T00:00:00Z',
      mode: 'emergency',
      grace_days: 0,
      expires_at: '2026-08-21T00:00:00Z',
    })
    expect(evaluate('2026-08-20T12:00:00Z', { license: emergency }).state).toBe('recovery')
    expect(evaluate('2026-08-21T00:00:01Z', { license: emergency }).state).toBe('expired_read_only')
  })

  it('allows a newer signed emergency license to recover clock evidence', () => {
    const emergency = license({
      license_id: '018f47a7-5b9c-7d31-8e1a-c7c77d79f403',
      sequence: 3,
      issued_at: '2026-08-20T00:00:00Z',
      not_before: '2026-08-20T00:00:00Z',
      mode: 'emergency',
      grace_days: 0,
      expires_at: '2026-08-21T00:00:00Z',
    })
    const decision = evaluate('2026-08-20T12:00:00Z', {
      license: emergency,
      evidence: {
        max_observed_at: '2026-09-20T12:00:00Z',
        highest_sequence: 2,
        highest_sequence_license_id: '018f47a7-5b9c-7d31-8e1a-c7c77d79f402',
      },
    })
    expect(decision.state).toBe('recovery')
    expect(decision.next_evidence.max_observed_at).toBe('2026-08-20T12:00:00.000Z')
    expect(decision.next_evidence.highest_sequence).toBe(3)
  })

  it('rejects emergency licenses longer than 72 hours', () => {
    const emergency = license({
      mode: 'emergency',
      grace_days: 0,
      expires_at: '2026-08-05T00:00:01Z',
    })
    expect(evaluate('2026-08-02T00:00:00Z', { license: emergency }).reason).toBe('malformed')
  })
})
