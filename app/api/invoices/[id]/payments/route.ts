import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { generatePaymentNo } from '@/lib/billing-utils'
import { PaymentMethod } from '@prisma/client'

// GET - Get payments for an invoice
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole([
    'ADMIN',
    'ACCOUNTANT',
    'RECEPTIONIST',
    'DOCTOR',
  ])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    // Check if invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { id, hospitalId },
      select: {
        id: true,
        invoiceNo: true,
        totalAmount: true,
        paidAmount: true,
        balanceAmount: true,
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const payments = await prisma.payment.findMany({
      where: { invoiceId: id, hospitalId },
      orderBy: {
        paymentDate: 'desc',
      },
      include: {
        recordedBy: { select: { id: true, name: true, role: true } },
      },
    })

    return NextResponse.json({
      invoice,
      payments,
    })
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

// POST - Record a payment for an invoice
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId, session } = await requireAuthAndRole([
    'ADMIN',
    'ACCOUNTANT',
    'RECEPTIONIST',
  ])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    const {
      amount,
      paymentMethod,
      paymentDate = new Date(),
      transactionId,
      bankName,
      providerName,
      chequeNumber,
      chequeDate,
      upiId,
      notes,
    } = body

    // Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 })
    }

    if (!paymentMethod || !Object.values(PaymentMethod).includes(paymentMethod)) {
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 })
    }

    if (['TELEBIRR', 'BANK_TRANSFER', 'OTHER'].includes(paymentMethod) && !providerName) {
      return NextResponse.json(
        { error: 'Payment provider or bank is required for this payment method' },
        { status: 400 }
      )
    }

    // Check if invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { id, hospitalId },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Check if invoice can accept payments
    if (invoice.status === 'CANCELLED' || invoice.status === 'REFUNDED') {
      return NextResponse.json(
        { error: 'Cannot add payment to a cancelled or refunded invoice' },
        { status: 400 }
      )
    }

    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'Invoice is already fully paid' }, { status: 400 })
    }

    // Check if payment amount exceeds balance
    const currentBalance = Number(invoice.balanceAmount)
    if (amount > currentBalance) {
      return NextResponse.json(
        { error: `Payment amount (${amount}) exceeds balance (${currentBalance})` },
        { status: 400 }
      )
    }

    // Update invoice amounts
    const newPaidAmount = Number(invoice.paidAmount) + amount
    const newBalanceAmount = Number(invoice.totalAmount) - newPaidAmount

    // Determine new invoice status
    let newStatus:
      'DRAFT' | 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED' =
      invoice.status
    if (newBalanceAmount <= 0) {
      newStatus = 'PAID'
    } else if (newPaidAmount > 0) {
      newStatus = 'PARTIALLY_PAID'
    }

    // Update the invoice status to PENDING if it's still DRAFT
    if (invoice.status === 'DRAFT') {
      newStatus = newBalanceAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID'
    }

    const result = await prisma.$transaction(async (tx) => {
      // Reserve the exact balance we read. If another payment changed it first,
      // this update affects zero rows and no Payment record is created.
      const reserved = await tx.invoice.updateMany({
        where: {
          id,
          hospitalId,
          status: invoice.status,
          balanceAmount: invoice.balanceAmount,
        },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          status: newStatus,
        },
      })

      if (reserved.count !== 1) return null

      const paymentNo = await generatePaymentNo(tx)
      const payment = await tx.payment.create({
        data: {
          hospitalId,
          paymentNo,
          invoiceId: id,
          amount,
          paymentMethod: paymentMethod as PaymentMethod,
          paymentDate: new Date(paymentDate),
          status: 'COMPLETED',
          transactionId,
          bankName: bankName || (paymentMethod === 'BANK_TRANSFER' ? providerName : null),
          providerName,
          recordedById: session.user.id,
          chequeNumber,
          chequeDate: chequeDate ? new Date(chequeDate) : null,
          upiId,
          notes,
        },
        include: {
          recordedBy: { select: { id: true, name: true, role: true } },
        },
      })

      const updatedInvoice = await tx.invoice.findUnique({
        where: { id, hospitalId },
        include: {
          patient: {
            select: {
              id: true,
              patientId: true,
              firstName: true,
              lastName: true,
            },
          },
          payments: {
            orderBy: {
              paymentDate: 'desc',
            },
            include: {
              recordedBy: { select: { id: true, name: true, role: true } },
            },
          },
        },
      })

      return { payment, invoice: updatedInvoice }
    })

    if (!result) {
      return NextResponse.json(
        { error: 'Invoice balance changed while recording payment. Refresh and try again.' },
        { status: 409 }
      )
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error recording payment:', error)
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })
  }
}
