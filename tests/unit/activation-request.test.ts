import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { installationIdFor, verifyActivationRequest } from '@/lib/licensing/activation-request'

const vector = JSON.parse(
  readFileSync(
    path.join(process.cwd(), 'docs/licensing/test-vectors/v1-activation-request.json'),
    'utf8'
  )
)

describe('activation request verification', () => {
  it('verifies the Python-generated cross-language vector', () => {
    const payload = verifyActivationRequest(vector.request)
    expect(payload.installation_id).toBe(vector.installation_id)
    expect(payload.delivery).toBe('offline')
  })

  it('calculates a stable RFC 7638 installation identity', () => {
    const payload = verifyActivationRequest(vector.request)
    expect(installationIdFor(payload.installation_public_key)).toBe(vector.installation_id)
  })

  it('rejects payload tampering', () => {
    const request = { ...vector.request, payload: `${vector.request.payload.slice(0, -1)}A` }
    expect(() => verifyActivationRequest(request)).toThrow()
  })

  it('rejects a mismatched header identity', () => {
    const header = JSON.parse(Buffer.from(vector.request.protected, 'base64url').toString())
    header.kid = 'another-installation'
    const request = {
      ...vector.request,
      protected: Buffer.from(JSON.stringify(header)).toString('base64url'),
    }
    expect(() => verifyActivationRequest(request)).toThrow('Installation identity mismatch')
  })

  it('rejects malformed nonces and unknown fields', () => {
    const payload = JSON.parse(Buffer.from(vector.request.payload, 'base64url').toString())
    payload.nonce = 'c2hvcnQ'
    payload.patient_name = 'must never be accepted'
    const request = {
      ...vector.request,
      payload: Buffer.from(JSON.stringify(payload)).toString('base64url'),
    }
    expect(() => verifyActivationRequest(request)).toThrow('Invalid activation payload')
  })
})
