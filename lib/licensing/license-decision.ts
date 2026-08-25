import { createPublicKey, verify as verifySignature } from 'node:crypto'

export const LICENSE_FORMAT = 'sunny-smile-offline-license/v1'
export const LICENSE_TYPE = 'sunny-smile-offline-license+jws'
export const STANDARD_GRACE_DAYS = 5
export const DEFAULT_CLOCK_ROLLBACK_TOLERANCE_SECONDS = 5 * 60

export type LicenseState = 'active' | 'grace' | 'expired_read_only' | 'invalid' | 'recovery'

export type LicenseReason =
  | 'ok'
  | 'within_grace'
  | 'expired'
  | 'malformed'
  | 'unsupported_format'
  | 'unknown_signing_key'
  | 'invalid_signature'
  | 'wrong_product'
  | 'wrong_installation'
  | 'not_yet_valid'
  | 'clock_rollback'
  | 'superseded_license'
  | 'sequence_conflict'

export type LicenseMode = 'standard' | 'emergency'

export interface LicensePayload {
  schema_version: 1
  license_id: string
  customer_id: string
  product_id: string
  installation_id: string
  sequence: number
  issued_at: string
  not_before: string
  expires_at: string
  mode: LicenseMode
  grace_days: number
  entitlements: string[]
}

export interface LicenseEvidence {
  max_observed_at?: string
  highest_sequence?: number
  highest_sequence_license_id?: string
}

export interface LicenseDecision {
  state: LicenseState
  reason: LicenseReason
  payload?: LicensePayload
  allows_read: boolean
  allows_write: boolean
  allows_recovery: true
  next_evidence: LicenseEvidence
}

export interface EvaluateLicenseOptions {
  license: string | unknown
  product_id: string
  installation_id: string
  public_keys: Readonly<Record<string, string>>
  now: Date
  evidence?: LicenseEvidence
  clock_rollback_tolerance_seconds?: number
}

interface LicenseEnvelope {
  format: typeof LICENSE_FORMAT
  protected: string
  payload: string
  signature: string
}

interface ProtectedHeader {
  alg: 'EdDSA'
  kid: string
  typ: typeof LICENSE_TYPE
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const INSTALLATION_ID_PATTERN = /^(?:[A-Za-z0-9][A-Za-z0-9._:-]{0,127}|[A-Za-z0-9_-]{43})$/
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/

function invalid(reason: LicenseReason, evidence: LicenseEvidence): LicenseDecision {
  return {
    state: 'invalid',
    reason,
    allows_read: true,
    allows_write: false,
    allows_recovery: true,
    next_evidence: evidence,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decodeBase64Url(value: unknown): Buffer {
  if (typeof value !== 'string' || !BASE64URL_PATTERN.test(value)) {
    throw new Error('Invalid base64url')
  }
  const decoded = Buffer.from(value, 'base64url')
  if (decoded.toString('base64url') !== value) {
    throw new Error('Non-canonical base64url')
  }
  return decoded
}

function parseJsonObject(encoded: unknown): Record<string, unknown> {
  const parsed: unknown = JSON.parse(decodeBase64Url(encoded).toString('utf8'))
  if (!isRecord(parsed)) throw new Error('Expected object')
  return parsed
}

function parseTimestamp(value: unknown): Date {
  if (typeof value !== 'string' || !UTC_TIMESTAMP_PATTERN.test(value)) {
    throw new Error('Invalid UTC timestamp')
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid UTC timestamp')
  return parsed
}

function parseEnvelope(input: string | unknown): LicenseEnvelope {
  const parsed: unknown = typeof input === 'string' ? JSON.parse(input) : input
  if (!isRecord(parsed)) throw new Error('Expected envelope')
  if (parsed.format !== LICENSE_FORMAT) throw new Error('Unsupported format')
  decodeBase64Url(parsed.protected)
  decodeBase64Url(parsed.payload)
  decodeBase64Url(parsed.signature)
  return parsed as unknown as LicenseEnvelope
}

function parseHeader(envelope: LicenseEnvelope): ProtectedHeader {
  const header = parseJsonObject(envelope.protected)
  if (header.alg !== 'EdDSA' || header.typ !== LICENSE_TYPE || typeof header.kid !== 'string') {
    throw new Error('Invalid protected header')
  }
  if (!ID_PATTERN.test(header.kid)) throw new Error('Invalid key identifier')
  if ('crit' in header) throw new Error('Unsupported critical header')
  return header as unknown as ProtectedHeader
}

function parsePayload(envelope: LicenseEnvelope): {
  payload: LicensePayload
  issuedAt: Date
  notBefore: Date
  expiresAt: Date
} {
  const value = parseJsonObject(envelope.payload)
  const mode = value.mode
  const entitlements = value.entitlements
  if (
    value.schema_version !== 1 ||
    typeof value.license_id !== 'string' ||
    !UUID_PATTERN.test(value.license_id) ||
    typeof value.customer_id !== 'string' ||
    !ID_PATTERN.test(value.customer_id) ||
    typeof value.product_id !== 'string' ||
    !ID_PATTERN.test(value.product_id) ||
    typeof value.installation_id !== 'string' ||
    !INSTALLATION_ID_PATTERN.test(value.installation_id) ||
    !Number.isSafeInteger(value.sequence) ||
    (value.sequence as number) < 1 ||
    (mode !== 'standard' && mode !== 'emergency') ||
    !Array.isArray(entitlements) ||
    !entitlements.every((entry) => typeof entry === 'string' && ID_PATTERN.test(entry)) ||
    new Set(entitlements).size !== entitlements.length
  ) {
    throw new Error('Invalid payload')
  }
  if (
    (mode === 'standard' && value.grace_days !== STANDARD_GRACE_DAYS) ||
    (mode === 'emergency' && value.grace_days !== 0)
  ) {
    throw new Error('Invalid grace policy')
  }
  const issuedAt = parseTimestamp(value.issued_at)
  const notBefore = parseTimestamp(value.not_before)
  const expiresAt = parseTimestamp(value.expires_at)
  if (issuedAt > notBefore || notBefore >= expiresAt) throw new Error('Invalid validity window')
  if (mode === 'emergency' && expiresAt.getTime() - notBefore.getTime() > 72 * 60 * 60 * 1000) {
    throw new Error('Emergency license exceeds 72 hours')
  }
  return { payload: value as unknown as LicensePayload, issuedAt, notBefore, expiresAt }
}

function nextEvidence(
  evidence: LicenseEvidence,
  now: Date,
  payload?: LicensePayload
): LicenseEvidence {
  let previousMax: Date | undefined
  try {
    previousMax = evidence.max_observed_at ? parseTimestamp(evidence.max_observed_at) : undefined
  } catch {
    previousMax = now
  }
  const maxObserved = !previousMax || now > previousMax ? now : previousMax
  const currentSequence = evidence.highest_sequence ?? 0
  if (!payload || payload.sequence < currentSequence) {
    return { ...evidence, max_observed_at: maxObserved.toISOString() }
  }
  return {
    max_observed_at: maxObserved.toISOString(),
    highest_sequence: payload.sequence,
    highest_sequence_license_id: payload.license_id,
  }
}

export function evaluateLicense(options: EvaluateLicenseOptions): LicenseDecision {
  const evidence = options.evidence ?? {}
  let envelope: LicenseEnvelope
  try {
    envelope = parseEnvelope(options.license)
  } catch (error) {
    const reason =
      error instanceof Error && error.message === 'Unsupported format'
        ? 'unsupported_format'
        : 'malformed'
    return invalid(reason, nextEvidence(evidence, options.now))
  }

  let header: ProtectedHeader
  try {
    header = parseHeader(envelope)
  } catch {
    return invalid('malformed', nextEvidence(evidence, options.now))
  }
  const publicKey = options.public_keys[header.kid]
  if (!publicKey) return invalid('unknown_signing_key', nextEvidence(evidence, options.now))

  let signatureIsValid = false
  try {
    signatureIsValid = verifySignature(
      null,
      Buffer.from(`${envelope.protected}.${envelope.payload}`, 'ascii'),
      createPublicKey(publicKey),
      decodeBase64Url(envelope.signature)
    )
  } catch {
    return invalid('malformed', nextEvidence(evidence, options.now))
  }
  if (!signatureIsValid) return invalid('invalid_signature', nextEvidence(evidence, options.now))

  let parsed: ReturnType<typeof parsePayload>
  try {
    parsed = parsePayload(envelope)
  } catch {
    return invalid('malformed', nextEvidence(evidence, options.now))
  }
  const { payload, notBefore, expiresAt } = parsed
  if (payload.product_id !== options.product_id)
    return invalid('wrong_product', nextEvidence(evidence, options.now))
  if (payload.installation_id !== options.installation_id)
    return invalid('wrong_installation', nextEvidence(evidence, options.now))

  const highestSequence = evidence.highest_sequence ?? 0
  let clockRollback = false
  let maxObserved: Date | undefined
  try {
    maxObserved = evidence.max_observed_at ? parseTimestamp(evidence.max_observed_at) : undefined
  } catch {
    clockRollback = true
  }
  const tolerance =
    (options.clock_rollback_tolerance_seconds ?? DEFAULT_CLOCK_ROLLBACK_TOLERANCE_SECONDS) * 1000
  if (maxObserved && options.now.getTime() + tolerance < maxObserved.getTime()) {
    clockRollback = true
  }
  const canRecoverClock = payload.mode === 'emergency' && payload.sequence > highestSequence
  if (clockRollback && !canRecoverClock) {
    return invalid('clock_rollback', nextEvidence(evidence, options.now))
  }
  if (payload.sequence < highestSequence)
    return invalid('superseded_license', nextEvidence(evidence, options.now))
  if (
    payload.sequence === highestSequence &&
    evidence.highest_sequence_license_id &&
    payload.license_id !== evidence.highest_sequence_license_id
  ) {
    return invalid('sequence_conflict', nextEvidence(evidence, options.now))
  }
  if (options.now < notBefore) return invalid('not_yet_valid', nextEvidence(evidence, options.now))

  const updatedEvidence = clockRollback
    ? {
        max_observed_at: options.now.toISOString(),
        highest_sequence: payload.sequence,
        highest_sequence_license_id: payload.license_id,
      }
    : nextEvidence(evidence, options.now, payload)

  if (options.now <= expiresAt) {
    return {
      state: payload.mode === 'emergency' ? 'recovery' : 'active',
      reason: 'ok',
      payload,
      allows_read: true,
      allows_write: true,
      allows_recovery: true,
      next_evidence: updatedEvidence,
    }
  }

  const graceEnds = new Date(expiresAt.getTime() + payload.grace_days * 24 * 60 * 60 * 1000)
  if (payload.mode === 'standard' && options.now <= graceEnds) {
    return {
      state: 'grace',
      reason: 'within_grace',
      payload,
      allows_read: true,
      allows_write: true,
      allows_recovery: true,
      next_evidence: updatedEvidence,
    }
  }
  return {
    state: 'expired_read_only',
    reason: 'expired',
    payload,
    allows_read: true,
    allows_write: false,
    allows_recovery: true,
    next_evidence: updatedEvidence,
  }
}
