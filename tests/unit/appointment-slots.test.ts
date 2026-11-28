import { describe, expect, it } from 'vitest'
import {
  buildTimeSlots,
  formatSlotLabel,
  isSlotUnavailable,
  todayInputValue,
} from '@/lib/appointment-slots'

describe('appointment slots', () => {
  it('builds 30-minute slots from 08:00 to 17:30', () => {
    const slots = buildTimeSlots()
    expect(slots[0]).toBe('08:00')
    expect(slots[slots.length - 1]).toBe('17:30')
    expect(slots).toHaveLength(20)
  })

  it('formats 24-hour slots as 12-hour labels', () => {
    expect(formatSlotLabel('08:00')).toBe('8:00 AM')
    expect(formatSlotLabel('12:30')).toBe('12:30 PM')
    expect(formatSlotLabel('17:30')).toBe('5:30 PM')
  })

  it('marks booked slots unavailable', () => {
    const now = new Date(2026, 10, 28, 7, 0)
    expect(isSlotUnavailable('09:00', '2026-11-29', new Set(['09:00']), now)).toBe(true)
    expect(isSlotUnavailable('09:30', '2026-11-29', new Set(['09:00']), now)).toBe(false)
  })

  it('blocks past times today but not future days', () => {
    const now = new Date(2026, 10, 28, 10, 15)
    expect(todayInputValue(now)).toBe('2026-11-28')
    expect(isSlotUnavailable('10:00', '2026-11-28', new Set(), now)).toBe(true)
    expect(isSlotUnavailable('10:30', '2026-11-28', new Set(), now)).toBe(false)
    expect(isSlotUnavailable('08:00', '2026-11-29', new Set(), now)).toBe(false)
  })
})
