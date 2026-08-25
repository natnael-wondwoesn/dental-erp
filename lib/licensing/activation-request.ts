import { createHash, createPublicKey, verify } from 'node:crypto'

export const ACTIVATION_FORMAT = 'sunny-smile-activation-request/v1'
export const ACTIVATION_TYPE = 'sunny-smile-activation-request+jws'

export interface ActivationRequestPayload {
  schema_version: 1
  request_id: string
  product_id: string
  installation_id: string
  installation_public_key: { crv: 'Ed25519'; kty: 'OKP'; x: string }
  created_at: string
  nonce: string
  app_version: string
  platform: 'windows'
  delivery: 'online' | 'offline'
}

const B64 = /^[A-Za-z0-9_-]+$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decode(value: unknown): Buffer {
  if (typeof value !== 'string' || !B64.test(value)) throw new Error('Invalid base64url')
  const result = Buffer.from(value, 'base64url')
  if (result.toString('base64url') !== value) throw new Error('Non-canonical base64url')
  return result
}

function jsonObject(value: unknown): Record<string, unknown> {
  const parsed: unknown = JSON.parse(decode(value).toString('utf8'))
  if (!record(parsed)) throw new Error('Expected object')
  return parsed
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).sort().join('|') === [...keys].sort().join('|')
}

export function installationIdFor(jwk: unknown): string {
  if (!record(jwk) || !exactKeys(jwk, ['crv', 'kty', 'x']))
    throw new Error('Invalid installation key')
  if (jwk.crv !== 'Ed25519' || jwk.kty !== 'OKP' || decode(jwk.x).length !== 32) {
    throw new Error('Invalid Ed25519 installation key')
  }
  const canonical = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x })
  return createHash('sha256').update(canonical).digest('base64url')
}

export function verifyActivationRequest(input: string | unknown): ActivationRequestPayload {
  const envelope: unknown = typeof input === 'string' ? JSON.parse(input) : input
  if (!record(envelope) || !exactKeys(envelope, ['format', 'protected', 'payload', 'signature'])) {
    throw new Error('Invalid activation envelope')
  }
  if (envelope.format !== ACTIVATION_FORMAT) throw new Error('Unsupported activation format')
  const header = jsonObject(envelope.protected)
  const payload = jsonObject(envelope.payload)
  if (
    !exactKeys(header, ['alg', 'kid', 'typ']) ||
    header.alg !== 'EdDSA' ||
    header.typ !== ACTIVATION_TYPE
  ) {
    throw new Error('Invalid activation header')
  }
  const required = [
    'schema_version',
    'request_id',
    'product_id',
    'installation_id',
    'installation_public_key',
    'created_at',
    'nonce',
    'app_version',
    'platform',
    'delivery',
  ]
  if (
    !exactKeys(payload, required) ||
    payload.schema_version !== 1 ||
    !UUID.test(String(payload.request_id)) ||
    !ID.test(String(payload.product_id)) ||
    !ID.test(String(payload.app_version)) ||
    payload.platform !== 'windows' ||
    (payload.delivery !== 'online' && payload.delivery !== 'offline') ||
    !UTC.test(String(payload.created_at)) ||
    decode(payload.nonce).length !== 24
  ) {
    throw new Error('Invalid activation payload')
  }
  const installationId = installationIdFor(payload.installation_public_key)
  if (payload.installation_id !== installationId || header.kid !== installationId) {
    throw new Error('Installation identity mismatch')
  }
  const jwk = payload.installation_public_key as JsonWebKey
  const valid = verify(
    null,
    Buffer.from(`${envelope.protected}.${envelope.payload}`, 'ascii'),
    createPublicKey({ key: jwk, format: 'jwk' }),
    decode(envelope.signature)
  )
  if (!valid) throw new Error('Invalid activation signature')
  return payload as unknown as ActivationRequestPayload
}
