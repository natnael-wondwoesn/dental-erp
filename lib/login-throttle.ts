import { createHash } from 'crypto'

const MAX_FAILURES = 5
const WINDOW_MS = 15 * 60 * 1000
const MAX_ENTRIES = 10_000

type Entry = { failures: number; expiresAt: number }
const attempts = new Map<string, Entry>()

function key(identifier: string, ip: string) {
  return createHash('sha256').update(`${identifier.trim().toLowerCase()}|${ip}`).digest('hex')
}

function prune(now: number) {
  for (const [entryKey, entry] of attempts) {
    if (entry.expiresAt <= now) attempts.delete(entryKey)
  }
  while (attempts.size >= MAX_ENTRIES) {
    const oldest = attempts.keys().next().value
    if (!oldest) break
    attempts.delete(oldest)
  }
}

export function loginClientIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0] ||
    'unknown'
  ).trim()
}

export function isLoginBlocked(identifier: string, ip: string, now = Date.now()): boolean {
  const entry = attempts.get(key(identifier, ip))
  if (!entry || entry.expiresAt <= now) return false
  return entry.failures >= MAX_FAILURES
}

export function recordLoginFailure(identifier: string, ip: string, now = Date.now()) {
  prune(now)
  const entryKey = key(identifier, ip)
  const existing = attempts.get(entryKey)
  attempts.set(entryKey, {
    failures: existing && existing.expiresAt > now ? existing.failures + 1 : 1,
    expiresAt: now + WINDOW_MS,
  })
}

export function clearLoginFailures(identifier: string, ip: string) {
  attempts.delete(key(identifier, ip))
}
