import { endOfLocalDay, startOfLocalDay } from '@/lib/payment-deadlines'

const DAY_MS = 24 * 60 * 60 * 1000
export const LAB_DUE_SOON_DAYS = 3
export type LabDeadlineState = 'NONE' | 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE'

const COMPLETE_STATUSES = new Set(['FITTED', 'CANCELLED'])

export function classifyLabDeadline(
  expectedDate: Date | string | null | undefined,
  status: string,
  now = new Date()
): LabDeadlineState {
  if (!expectedDate || COMPLETE_STATUSES.has(status)) return 'NONE'
  const expected = startOfLocalDay(new Date(expectedDate))
  const today = startOfLocalDay(now)
  const days = Math.round((expected.getTime() - today.getTime()) / DAY_MS)
  if (days < 0) return 'OVERDUE'
  if (days <= LAB_DUE_SOON_DAYS) return 'DUE_SOON'
  return 'ON_TRACK'
}

export function labReminderRange(now = new Date()): { start: Date; end: Date } {
  const end = new Date(now)
  end.setDate(end.getDate() + LAB_DUE_SOON_DAYS)
  return { start: startOfLocalDay(now), end: endOfLocalDay(end) }
}

export function labStatusLabel(status: string): string {
  if (status === 'SENT_TO_LAB') return 'Sent'
  if (status === 'DELIVERED') return 'Received'
  if (status === 'FITTED') return 'Delivered to Patient'
  return status
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
