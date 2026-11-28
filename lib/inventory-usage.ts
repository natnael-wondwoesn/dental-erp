/** Helpers for the daily item-usage view (stock consumption logged per day). */

/**
 * Start (inclusive) and end (exclusive) of the calendar day containing `now`
 * for a client whose local time is `tzOffsetMinutes` behind UTC
 * (the value of `Date.getTimezoneOffset()`, so Addis Ababa is -180).
 */
export function getDayRange(now: Date, tzOffsetMinutes = 0): { start: Date; end: Date } {
  const offsetMs = tzOffsetMinutes * 60_000
  const local = new Date(now.getTime() - offsetMs)
  const startLocalUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  const start = new Date(startLocalUtc + offsetMs)
  return { start, end: new Date(start.getTime() + 86_400_000) }
}

/** Returns an error message when the usage quantity is not allowed, otherwise null. */
export function validateUsageQuantity(quantity: unknown, currentStock: number): string | null {
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
    return 'Quantity must be a whole number greater than 0'
  }
  if (quantity > currentStock) {
    return `Quantity cannot exceed current stock (${currentStock})`
  }
  return null
}
