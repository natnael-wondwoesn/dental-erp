const ETHIOPIA_OFFSET = '+03:00'
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

type ShiftHours = { startTime?: string | null; endTime?: string | null; isActive?: boolean } | null

export type BookingHours = {
  start: string
  end: string
  lunchStart?: string
  lunchEnd?: string
}

export function resolveBookingHours(
  rawWorkingHours: string | null,
  date: Date,
  shift: ShiftHours
): BookingHours | null {
  const defaults: BookingHours = {
    start: '09:00',
    end: '21:00',
    lunchStart: '13:00',
    lunchEnd: '14:00',
  }
  let resolved = defaults

  if (rawWorkingHours) {
    try {
      const parsed = JSON.parse(rawWorkingHours)
      const weekday = parsed?.[DAY_NAMES[date.getUTCDay()]]
      if (weekday && typeof weekday === 'object') {
        if (typeof weekday.open !== 'string' || typeof weekday.close !== 'string') return null
        resolved = { start: weekday.open, end: weekday.close }
      } else if (typeof parsed?.start === 'string' && typeof parsed?.end === 'string') {
        resolved = {
          start: parsed.start,
          end: parsed.end,
          lunchStart: typeof parsed.lunchStart === 'string' ? parsed.lunchStart : undefined,
          lunchEnd: typeof parsed.lunchEnd === 'string' ? parsed.lunchEnd : undefined,
        }
      }
    } catch {
      // Older installations may contain malformed JSON; retain safe defaults.
    }
  }

  if (shift?.isActive !== false && shift?.startTime && shift?.endTime) {
    return { ...resolved, start: shift.startTime, end: shift.endTime }
  }
  return resolved
}

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
