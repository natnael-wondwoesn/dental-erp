import { describe, expect, it } from 'vitest'
import {
  classifyPaymentDeadline,
  defaultPaymentDeadline,
  paymentReminderMetadata,
  reminderTargetRange,
} from '@/lib/payment-deadlines'
import { classifyLabDeadline, labStatusLabel } from '@/lib/lab-deadlines'

describe('payment deadlines', () => {
  it('defaults invoices to six calendar months and clamps month end', () => {
    expect(defaultPaymentDeadline(new Date(2026, 7, 31))).toEqual(new Date(2027, 1, 28))
  })

  it('targets exactly seven days from today', () => {
    const range = reminderTargetRange(new Date(2026, 9, 24, 14))
    expect(range.start).toEqual(new Date(2026, 9, 31, 0, 0, 0, 0))
    expect(range.end).toEqual(new Date(2026, 9, 31, 23, 59, 59, 999))
  })

  it('classifies upcoming, due-soon and overdue balances', () => {
    const now = new Date(2026, 9, 24, 12)
    expect(classifyPaymentDeadline(new Date(2026, 10, 20), now)).toBe('UPCOMING')
    expect(classifyPaymentDeadline(new Date(2026, 9, 31), now)).toBe('DUE_SOON')
    expect(classifyPaymentDeadline(new Date(2026, 9, 23), now)).toBe('OVERDUE')
  })

  it('builds stable per-invoice reminder metadata', () => {
    expect(paymentReminderMetadata('inv-1', new Date('2026-10-31T00:00:00Z'))).toContain(
      'six_month_balance_reminder'
    )
  })
})

describe('lab deadlines', () => {
  const now = new Date(2026, 9, 24, 12)

  it('flags approaching and overdue open lab work', () => {
    expect(classifyLabDeadline(new Date(2026, 9, 27), 'IN_PROGRESS', now)).toBe('DUE_SOON')
    expect(classifyLabDeadline(new Date(2026, 9, 23), 'READY', now)).toBe('OVERDUE')
    expect(classifyLabDeadline(new Date(2026, 9, 20), 'FITTED', now)).toBe('NONE')
  })

  it('uses clinic-facing status names', () => {
    expect(labStatusLabel('SENT_TO_LAB')).toBe('Sent')
    expect(labStatusLabel('DELIVERED')).toBe('Received')
    expect(labStatusLabel('FITTED')).toBe('Delivered to Patient')
  })
})
