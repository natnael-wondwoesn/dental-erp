/** Pure helpers for the btFana "Patient Management" page and its walk-in API. */

export type VisitStatusKey = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED'

export interface VisitLike {
  status: string
  checkedInAt?: string | Date | null
  scheduledTime?: string | null
  appointmentType?: string | null
  doctorId?: string | null
  patient?: {
    patientId?: string | null
    firstName?: string | null
    lastName?: string | null
    phone?: string | null
  } | null
}

const VISIT_STATUS_MAP: Record<string, VisitStatusKey> = {
  CHECKED_IN: 'WAITING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
}

export const VISIT_STATUS_LABEL: Record<VisitStatusKey, string> = {
  WAITING: 'Waiting',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
}

/** Appointment statuses that mean the patient is physically in the clinic today. */
export const ACTIVE_VISIT_STATUSES = ['CHECKED_IN', 'IN_PROGRESS'] as const

/** Maps an appointment status to a visit status, or null when it is not a visit (cancelled, no-show, ...). */
export function toVisitStatus(status: string): VisitStatusKey | null {
  return VISIT_STATUS_MAP[status] ?? null
}

export function isVisit(a: Pick<VisitLike, 'status'>): boolean {
  return toVisitStatus(a.status) !== null
}

export function visitTypeLabel(appointmentType?: string | null): 'New' | 'Follow-up' {
  return appointmentType === 'FOLLOW_UP' ? 'Follow-up' : 'New'
}

export function appointmentTypeLabel(appointmentType?: string | null): string {
  return appointmentType === 'FOLLOW_UP' ? 'Follow-up' : 'New Consultation'
}

const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Pending',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Arrived',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
  RESCHEDULED: 'Rescheduled',
}

export function appointmentStatusLabel(status: string): string {
  return APPOINTMENT_STATUS_LABEL[status] ?? status
}

/** Visits only, ordered by check-in time ascending (falls back to scheduled time). */
export function sortVisits<T extends VisitLike>(visits: T[]): T[] {
  const key = (v: T) =>
    v.checkedInAt ? new Date(v.checkedInAt).getTime() : Number.MAX_SAFE_INTEGER
  return [...visits].sort((a, b) => {
    const diff = key(a) - key(b)
    if (diff !== 0) return diff
    return (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? '')
  })
}

export function matchesPatientSearch(v: VisitLike, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const p = v.patient
  const haystack = [
    p?.patientId,
    p?.firstName,
    p?.lastName,
    `${p?.firstName} ${p?.lastName}`,
    p?.phone,
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
  return haystack.includes(q)
}

/** Today's visit list: cancelled / no-show / not-yet-arrived appointments are excluded. */
export function buildTodayVisits<T extends VisitLike>(
  appointments: T[],
  opts: { search?: string; doctorId?: string } = {}
): T[] {
  const filtered = appointments.filter(
    (a) =>
      isVisit(a) &&
      matchesPatientSearch(a, opts.search ?? '') &&
      (!opts.doctorId || opts.doctorId === 'all' || a.doctorId === opts.doctorId)
  )
  return sortVisits(filtered)
}

export interface VisitSummary {
  total: number
  waiting: number
  inProgress: number
  completed: number
}

export function summarizeVisits(visits: Pick<VisitLike, 'status'>[]): VisitSummary {
  const summary: VisitSummary = { total: 0, waiting: 0, inProgress: 0, completed: 0 }
  for (const v of visits) {
    const s = toVisitStatus(v.status)
    if (!s) continue
    summary.total++
    if (s === 'WAITING') summary.waiting++
    else if (s === 'IN_PROGRESS') summary.inProgress++
    else summary.completed++
  }
  return summary
}

export type AppointmentRange = 'today' | 'upcoming' | 'all'

/** YYYY-MM-DD in local time (the clinic's wall-clock day). */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type WalkInDecision =
  | { action: 'create' }
  | { action: 'existing-active'; appointmentId: string }
  | { action: 'check-in-scheduled'; appointmentId: string }

/**
 * Decide what a walk-in request for a patient should do given the patient's appointments for today.
 * - already checked in / in progress -> return that visit, never create a second one
 * - has a pending scheduled/confirmed appointment today -> check that one in instead of creating another
 * - otherwise create a new visit
 */
export function decideWalkIn(todays: { id: string; status: string }[]): WalkInDecision {
  const active = todays.find((a) => (ACTIVE_VISIT_STATUSES as readonly string[]).includes(a.status))
  if (active) return { action: 'existing-active', appointmentId: active.id }
  const pending = todays.find((a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED')
  if (pending) return { action: 'check-in-scheduled', appointmentId: pending.id }
  return { action: 'create' }
}

/** "HH:mm" wall-clock time in the clinic's timezone (the server clock runs in UTC). */
export function clinicClockTime(date: Date, timeZone: string = 'Africa/Addis_Ababa'): string {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)
  } catch {
    return clinicClockTime(date)
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('hour')}:${get('minute')}`
}
