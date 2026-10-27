import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { calculateInvoiceTotals } from '@/lib/billing-utils'
import { DiscountType } from '@prisma/client'

const OPEN_STATUSES = ['DRAFT', 'PENDING', 'PARTIALLY_PAID', 'OVERDUE']

// POST - Add new charges to an existing open invoice (adds to the patient's outstanding balance)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    if (!['ADMIN', 'ACCOUNTANT', 'RECEPTIONIST'].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You don't have permission to update invoices" },
        { status: 403 }
      )
    }

    const { id } = await params
    const { items } = await request.json()

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }
    for (const item of items) {
      if (!item.description || !(item.quantity > 0) || !(item.unitPrice >= 0)) {
        return NextResponse.json(
          {
            error:
              'Invalid item data. Description, quantity (>0), and unit price (>=0) are required',
          },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id, hospitalId },
        include: { items: true },
      })
      if (!invoice) return { status: 404 as const, error: 'Invoice not found' }
      if (!OPEN_STATUSES.includes(invoice.status)) {
        return {
          status: 400 as const,
          error: 'Charges can only be added to an open (unpaid or partially paid) invoice',
        }
      }

      await tx.invoiceItem.createMany({
        data: items.map((item: any) => ({
          invoiceId: id,
          treatmentId: item.treatmentId || null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.quantity * item.unitPrice,
          taxable: item.taxable !== false,
        })),
      })

      const allItems = [
        ...invoice.items.map((i) => ({
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          taxable: i.taxable,
        })),
        ...items.map((i: any) => ({
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          taxable: i.taxable !== false,
        })),
      ]
      const totals = calculateInvoiceTotals(
        allItems,
        (invoice.discountType || 'FIXED') as DiscountType,
        Number(invoice.discountValue || 0),
        Number(invoice.cgstRate),
        Number(invoice.sgstRate)
      )
      const paid = Number(invoice.paidAmount)
      const balance = Math.max(totals.totalAmount - paid, 0)

      const result = await tx.invoice.update({
        where: { id },
        data: {
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxableAmount: totals.taxableAmount,
          cgstAmount: totals.cgstAmount,
          sgstAmount: totals.sgstAmount,
          totalAmount: totals.totalAmount,
          balanceAmount: balance,
        },
        select: {
          id: true,
          invoiceNo: true,
          totalAmount: true,
          paidAmount: true,
          balanceAmount: true,
        },
      })
      return { status: 200 as const, invoice: result }
    })

    if (updated.status !== 200) {
      return NextResponse.json({ error: updated.error }, { status: updated.status })
    }
    return NextResponse.json(updated.invoice)
  } catch (error) {
    console.error('Error adding invoice items:', error)
    return NextResponse.json({ error: 'Failed to add charges to invoice' }, { status: 500 })
  }
}
