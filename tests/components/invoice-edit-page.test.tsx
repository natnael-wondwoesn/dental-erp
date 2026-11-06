import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const router = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'inv-1' }),
  useRouter: () => router,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import EditInvoicePage from '@/app/(dashboard)/billing/invoices/[id]/edit/page'

const invoice = (over: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  invoiceNo: 'INV-202611-0007',
  status: 'PENDING',
  patientId: 'p1',
  patient: { firstName: 'Abebe', lastName: 'Kebede', patientId: 'PAT-1', phone: '0911' },
  items: [
    {
      id: 'i1',
      treatmentId: 't1',
      description: '3rd Molar Extraction',
      quantity: 1,
      unitPrice: 5000,
      taxable: false,
    },
  ],
  payments: [],
  discountType: 'FIXED',
  discountValue: 0,
  cgstRate: 15,
  sgstRate: 0,
  paidAmount: 0,
  dueDate: null,
  notes: null,
  termsAndConditions: null,
  ...over,
})

function mockFetch(inv: unknown) {
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') return { ok: true, json: async () => ({ id: 'inv-1' }) }
    if (String(url).startsWith('/api/billing/unbilled-treatments'))
      return { ok: true, json: async () => ({ treatments: [] }) }
    return { ok: true, json: async () => inv }
  }) as unknown as typeof fetch
}

beforeEach(() => {
  router.push.mockClear()
  // Radix form controls observe their size; jsdom has no ResizeObserver.
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})
afterEach(() => vi.restoreAllMocks())

describe('Edit invoice page', () => {
  it('loads the invoice, recalculates when the price changes and saves with PUT', async () => {
    mockFetch(invoice())
    render(<EditInvoicePage />)
    expect(await screen.findByText('Edit INV-202611-0007')).toBeTruthy()

    const price = screen.getByDisplayValue('5000') as HTMLInputElement
    fireEvent.change(price, { target: { value: '6000' } })
    await waitFor(() => expect(screen.getAllByText(/6,000/).length).toBeGreaterThan(0))

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/billing/invoices/inv-1'))
    const put = (global.fetch as any).mock.calls.find((c: any[]) => c[1]?.method === 'PUT')
    const body = JSON.parse(put[1].body)
    expect(body.items[0]).toMatchObject({ description: '3rd Molar Extraction', unitPrice: 6000 })
  })

  it('locks the items once a payment is recorded and only sends notes and due date', async () => {
    mockFetch(
      invoice({ status: 'PARTIALLY_PAID', paidAmount: 1000, payments: [{ status: 'COMPLETED' }] })
    )
    render(<EditInvoicePage />)
    await screen.findByText('Edit INV-202611-0007')
    expect(screen.getByText(/items and prices are locked/i)).toBeTruthy()
    expect((screen.getByDisplayValue('5000') as HTMLInputElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(router.push).toHaveBeenCalled())
    const put = (global.fetch as any).mock.calls.find((c: any[]) => c[1]?.method === 'PUT')
    const body = JSON.parse(put[1].body)
    expect(body).not.toHaveProperty('items')
    expect(body).toHaveProperty('notes')
  })

  it('does not allow saving an invoice with no items', async () => {
    mockFetch(invoice())
    render(<EditInvoicePage />)
    await screen.findByText('Edit INV-202611-0007')
    fireEvent.click(screen.getByRole('button', { name: /remove 3rd molar extraction/i }))
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect((global.fetch as any).mock.calls.some((c: any[]) => c[1]?.method === 'PUT')).toBe(false)
  })

  it('shows a paid invoice as read-only', async () => {
    mockFetch(invoice({ status: 'PAID' }))
    render(<EditInvoicePage />)
    await screen.findByText('Edit INV-202611-0007')
    expect(screen.getByText(/can no longer be edited/i)).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: /save changes/i }) as HTMLButtonElement).disabled
    ).toBe(true)
  })
})
