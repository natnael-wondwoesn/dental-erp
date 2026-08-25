/**
 * Issuer public keys shipped with a product release.
 *
 * Production release automation inserts active public keys here. Do not load
 * trust anchors from environment variables, the database, or clinic-writable
 * files. Issuer private keys must never enter this repository or installation.
 */
export const ISSUER_PUBLIC_KEYS: Readonly<Record<string, string>> = Object.freeze({})
