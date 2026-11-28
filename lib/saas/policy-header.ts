/**
 * HTTP header values must be Latin-1. The access policy carries clinic branding
 * (e.g. Amharic names), so escape every non-ASCII character as \uXXXX. The result
 * is still valid JSON and JSON.parse restores the original text.
 */
export function serializePolicyHeader(policy: unknown): string {
  return JSON.stringify(policy).replace(
    /[\u0080-￿]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
}
