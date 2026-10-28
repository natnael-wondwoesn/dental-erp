const DAY_MS = 24 * 60 * 60 * 1000

export const PAYMENT_DEADLINE_MONTHS = 6
export const PAYMENT_REMINDER_LEAD_DAYS = 7

/** Add calendar months while keeping month-end dates valid. */
export function defaultPaymentDeadline(from = new Date()): Date {
  const deadline = new Date(from)
  const originalDay = deadline.getDate()
  deadline.setDate(1)
  deadline.setMonth(deadline.getMonth() + PAYMENT_DEADLINE_MONTHS)
  const lastDay = new Date(deadline.getFullYear(), deadline.getMonth() + 1, 0).getDate()
  deadline.setDate(Math.min(originalDay, lastDay))
  return deadline
}

export function startOfLocalDay(value: Date): Date {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

export function endOfLocalDay(value: Date): Date {
  const date = new Date(value)
  date.setHours(23, 59, 59, 999)
  return date
}

export function reminderTargetRange(now = new Date()): { start: Date; end: Date } {
  const target = new Date(now)
  target.setDate(target.getDate() + PAYMENT_REMINDER_LEAD_DAYS)
  return { start: startOfLocalDay(target), end: endOfLocalDay(target) }
}

export type DeadlineState = 'UPCOMING' | 'DUE_SOON' | 'OVERDUE'

export function classifyPaymentDeadline(dueDate: Date | string, now = new Date()): DeadlineState {
  const due = startOfLocalDay(new Date(dueDate))
  const today = startOfLocalDay(now)
  const days = Math.round((due.getTime() - today.getTime()) / DAY_MS)
  if (days < 0) return 'OVERDUE'
  if (days <= PAYMENT_REMINDER_LEAD_DAYS) return 'DUE_SOON'
  return 'UPCOMING'
}

export function paymentReminderMetadata(invoiceId: string, dueDate: Date | string): string {
  return JSON.stringify({
    kind: 'six_month_balance_reminder',
    invoiceId,
    dueDate: new Date(dueDate).toISOString().slice(0, 10),
  })
}

export function paymentReminderMarker(invoiceId: string): string {
  return `\"invoiceId\":\"${invoiceId}\"`
}
