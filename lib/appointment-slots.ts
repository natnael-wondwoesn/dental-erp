/** 30-minute booking slots, 08:00 to 17:30, as 24-hour "HH:mm". */
export function buildTimeSlots(startHour = 8, endHour = 18, stepMinutes = 30): string[] {
  const slots: string[] = []
  for (let minutes = startHour * 60; minutes < endHour * 60; minutes += stepMinutes) {
    slots.push(
      `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
    )
  }
  return slots
}

export function formatSlotLabel(slot: string): string {
  const [h, m] = slot.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

/** Local calendar date as YYYY-MM-DD (the minimum selectable date is today). */
export function todayInputValue(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** A slot is unavailable if it is already booked or (for today) already in the past. */
export function isSlotUnavailable(
  slot: string,
  date: string,
  taken: ReadonlySet<string>,
  now = new Date()
): boolean {
  if (taken.has(slot)) return true
  if (date !== todayInputValue(now)) return false
  const [h, m] = slot.split(':').map(Number)
  return h * 60 + m <= now.getHours() * 60 + now.getMinutes()
}
