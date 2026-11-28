import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getDayRange, validateUsageQuantity } from '@/lib/inventory-usage'

const findMany = vi.fn()
const count = vi.fn()

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(async () => ({ error: null, hospitalId: 'h1', session: null })),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    stockTransaction: {
      count: (...a: any[]) => count(...a),
      findMany: (...a: any[]) => findMany(...a),
    },
    user: { findMany: vi.fn(async () => []) },
  },
}))

describe('getDayRange', () => {
  it('uses the UTC day when offset is 0', () => {
    const { start, end } = getDayRange(new Date('2026-11-28T15:30:00Z'), 0)
    expect(start.toISOString()).toBe('2026-11-28T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-29T00:00:00.000Z')
  })

  it('uses the local day for Addis Ababa (offset -180)', () => {
    // 22:00 UTC is already 01:00 on the 29th in Addis Ababa
    const { start, end } = getDayRange(new Date('2026-11-28T22:00:00Z'), -180)
    expect(start.toISOString()).toBe('2026-11-28T21:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-29T21:00:00.000Z')
  })
})

describe('validateUsageQuantity', () => {
  it('accepts whole numbers up to current stock', () => {
    expect(validateUsageQuantity(1, 5)).toBeNull()
    expect(validateUsageQuantity(5, 5)).toBeNull()
  })

  it('rejects zero, negatives, fractions and non-numbers', () => {
    expect(validateUsageQuantity(0, 5)).not.toBeNull()
    expect(validateUsageQuantity(-1, 5)).not.toBeNull()
    expect(validateUsageQuantity(1.5, 5)).not.toBeNull()
    expect(validateUsageQuantity(NaN, 5)).not.toBeNull()
    expect(validateUsageQuantity('2', 5)).not.toBeNull()
  })

  it('rejects quantity above stock', () => {
    expect(validateUsageQuantity(6, 5)).toContain('current stock')
  })
})

describe('GET /api/inventory/transactions date=today', () => {
  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([])
    count.mockReset().mockResolvedValue(0)
  })

  it('scopes to the hospital and the requested day', async () => {
    const { GET } = await import('@/app/api/inventory/transactions/route')
    const res = await GET(
      new NextRequest(
        'http://x/api/inventory/transactions?date=today&type=CONSUMPTION&tzOffset=-180'
      )
    )
    expect(res.status).toBe(200)
    const where = count.mock.calls[0][0].where
    expect(where.hospitalId).toBe('h1')
    expect(where.type).toBe('CONSUMPTION')
    expect(where.transactionDate.lt.getTime() - where.transactionDate.gte.getTime()).toBe(
      86_400_000
    )
  })

  it('leaves the filter untouched without date=today', async () => {
    const { GET } = await import('@/app/api/inventory/transactions/route')
    await GET(new NextRequest('http://x/api/inventory/transactions'))
    expect(count.mock.calls[0][0].where.transactionDate).toBeUndefined()
  })
})
