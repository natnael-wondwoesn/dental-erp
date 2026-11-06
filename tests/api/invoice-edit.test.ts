import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({ requireAuthAndRole: vi.fn() }))
vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const { PUT } = await import('@/app/api/invoices/[id]/route')

const ctx = { params: Promise.resolve({ id: 'inv-1' }) }
const put = (body: unknown) =>
  PUT(
    new Request('http://localhost/api/invoices/inv-1', {
      method: 'PUT',
      body: JSON.stringify(body),
    }) as never,
    ctx
  )

const existing = (over: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  status: 'PENDING',
  cgstRate: '15',
  sgstRate: '0',
  discountType: 'FIXED',
  discountValue: '0',
  paidAmount: '0',
  payments: [],
  ...over,
})

describe('PUT /api/invoices/[id] (edit invoice)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { id: 'u1', role: 'RECEPTIONIST' } },
    })
    ;(prisma.invoice.update as any).mockResolvedValue({ id: 'inv-1' })
    ;(prisma.invoiceItem.deleteMany as any).mockResolvedValue({ count: 1 })
    ;(prisma.invoiceItem.createMany as any).mockResolvedValue({ count: 1 })
  })

  it('lets reception edit items and recalculates the totals', async () => {
    ;(prisma.invoice.findUnique as any).mockResolvedValue(existing())
    const res = await put({
      items: [{ description: 'Extraction', quantity: 2, unitPrice: 1000, taxable: false }],
      discountType: 'FIXED',
      discountValue: 200,
    })
    expect(res.status).toBe(200)
    const data = (prisma.invoice.update as any).mock.calls[0][0].data
    expect(data.subtotal).toBe(2000)
    expect(data.discountAmount).toBe(200)
    expect(data.totalAmount).toBe(1800)
    expect(data.balanceAmount).toBe(1800)
    expect((prisma.invoiceItem.createMany as any).mock.calls[0][0].data[0]).toMatchObject({
      invoiceId: 'inv-1',
      description: 'Extraction',
      amount: 2000,
    })
  })

  it('rejects other roles', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'h1',
      session: { user: { id: 'u2', role: 'LAB_TECH' } },
    })
    expect((await put({ notes: 'x' })).status).toBe(403)
  })

  it.each(['PAID', 'CANCELLED', 'REFUNDED'])('does not edit a %s invoice', async (status) => {
    ;(prisma.invoice.findUnique as any).mockResolvedValue(existing({ status }))
    expect((await put({ notes: 'x' })).status).toBe(400)
    expect(prisma.invoice.update).not.toHaveBeenCalled()
  })

  it('freezes items once a payment is recorded but still allows notes and due date', async () => {
    ;(prisma.invoice.findUnique as any).mockResolvedValue(
      existing({ status: 'PARTIALLY_PAID', paidAmount: '500', payments: [{ status: 'COMPLETED' }] })
    )
    const blocked = await put({ items: [{ description: 'A', quantity: 1, unitPrice: 1 }] })
    expect(blocked.status).toBe(400)
    const ok = await put({ notes: 'Updated note', dueDate: '2026-12-01' })
    expect(ok.status).toBe(200)
    const data = (prisma.invoice.update as any).mock.calls[0][0].data
    expect(data.notes).toBe('Updated note')
    expect(data).not.toHaveProperty('totalAmount')
  })

  it('refuses a new total below what was already paid', async () => {
    ;(prisma.invoice.findUnique as any).mockResolvedValue(existing({ paidAmount: '1500' }))
    const res = await put({
      items: [{ description: 'Cheap', quantity: 1, unitPrice: 100, taxable: false }],
    })
    expect(res.status).toBe(400)
    expect(prisma.invoiceItem.deleteMany).not.toHaveBeenCalled()
  })

  it('validates the items', async () => {
    ;(prisma.invoice.findUnique as any).mockResolvedValue(existing())
    for (const items of [
      [],
      [{ description: '', quantity: 1, unitPrice: 5 }],
      [{ description: 'A', quantity: 0, unitPrice: 5 }],
      [{ description: 'A', quantity: 1, unitPrice: -5 }],
    ]) {
      expect((await put({ items })).status).toBe(400)
    }
    expect(prisma.invoiceItem.deleteMany).not.toHaveBeenCalled()
  })

  it('returns 404 for an invoice that is not in this clinic', async () => {
    ;(prisma.invoice.findUnique as any).mockResolvedValue(null)
    expect((await put({ notes: 'x' })).status).toBe(404)
    expect((prisma.invoice.findUnique as any).mock.calls[0][0].where).toEqual({
      id: 'inv-1',
      hospitalId: 'h1',
    })
  })
})
