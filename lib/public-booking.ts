const ETHIOPIA_OFFSET = '+03:00'

export function normalizeEthiopianPhone(value: string): string | null {
  const compact = value.trim().replace(/[\s()-]/g, '')
  let normalized = compact

  if (normalized.startsWith('00251')) normalized = `+${normalized.slice(2)}`
  else if (normalized.startsWith('0')) normalized = `+251${normalized.slice(1)}`
  else if (normalized.startsWith('251')) normalized = `+${normalized}`
  else if (/^9\d{8}$/.test(normalized)) normalized = `+251${normalized}`

  return /^\+251[79]\d{8}$/.test(normalized) ? normalized : null
}

export function ethiopianPhoneAliases(normalized: string): string[] {
  const national = normalized.slice(4)
  return [normalized, `0${national}`, `251${national}`]
}

export function parseBookingDate(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const parsed = new Date(`${date}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date
    ? null
    : parsed
}

export function bookingDateTime(date: string, time: string): Date | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !parseBookingDate(date)) return null
  const parsed = new Date(`${date}T${time}:00${ETHIOPIA_OFFSET}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function minutesSinceMidnight(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function overlaps(
  start: string,
  duration: number,
  otherStart: string,
  otherDuration: number
): boolean {
  const startMinutes = minutesSinceMidnight(start)
  const otherMinutes = minutesSinceMidnight(otherStart)
  return startMinutes < otherMinutes + otherDuration && startMinutes + duration > otherMinutes
}

export function makePublicRecordNumber(prefix: 'PAT' | 'APT'): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-WEB-${timestamp}-${random}`
}
