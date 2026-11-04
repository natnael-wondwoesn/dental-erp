import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedHospital } from '@/lib/api-helpers'
import { getGateway } from '@/lib/payment-gateways'

export async function POST(req: NextRequest) {
  try {
    const { error, user, hospitalId } = await getAuthenticatedHospital()
    if (error || !user || !hospitalId) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { invoiceId, orderId, paymentId, signature, ...extra } = body as {
      invoiceId: string
      orderId: string
      paymentId: string
      signature: string
      [key: string]: unknown
    }

    if (!invoiceId || !orderId || !paymentId) {
      return NextResponse.json(
        { error: 'invoiceId, orderId, paymentId are required' },
        { status: 400 }
      )
    }

    // Fetch invoice
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, hospitalId },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Get gateway
    const gatewayResult = await getGateway(hospitalId)
    if (!gatewayResult) {
      return NextResponse.json({ error: 'Payment gateway is not configured' }, { status: 400 })
    }

    const { gateway } = gatewayResult
    const provider = gatewayResult.credentials.provider.toLowerCase()
    const paymentOrder = await prisma.paymentOrder.findUnique({
      where: { provider_orderId: { provider, orderId } },
    })
    if (
      !paymentOrder ||
      paymentOrder.hospitalId !== hospitalId ||
      paymentOrder.invoiceId !== invoice.id ||
      paymentOrder.consumedAt ||
      paymentOrder.expiresAt < new Date()
    ) {
      return NextResponse.json({ error: 'Invalid or expired payment order' }, { status: 400 })
    }

    // Verify payment with gateway
    const result = await gateway.verifyPayment({
      orderId,
      paymentId,
      signature: signature || '',
      ...extra,
    })

    if (!result.verified || result.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Payment verification failed', status: result.status },
        { status: 400 }
      )
    }

    // Create Payment record and update Invoice in a transaction
    const paymentAmount = result.amount ?? Number(paymentOrder.amount)
    if (Math.abs(paymentAmount - Number(paymentOrder.amount)) > 0.001) {
      return NextResponse.json(
        { error: 'Payment amount does not match the order' },
        { status: 400 }
      )
    }
    const newPaidAmount = Number(invoice.paidAmount) + paymentAmount
    const newBalance = Number(invoice.totalAmount) - newPaidAmount

    // Generate payment number
    const lastPayment = await prisma.payment.findFirst({
      where: { hospitalId },
      orderBy: { createdAt: 'desc' },
      select: { paymentNo: true },
    })
    const lastNum = lastPayment ? parseInt(lastPayment.paymentNo.replace(/\D/g, '')) || 0 : 0
    const paymentNo = `PAY${String(lastNum + 1).padStart(5, '0')}`

    const payment = await prisma.$transaction(async (tx) => {
      const consumed = await tx.paymentOrder.updateMany({
        where: { id: paymentOrder.id, consumedAt: null },
        data: { consumedAt: new Date() },
      })
      if (consumed.count !== 1) throw new Error('PAYMENT_ALREADY_PROCESSED')

      const created = await tx.payment.create({
        data: {
          hospitalId,
          paymentNo,
          invoiceId: invoice.id,
          amount: paymentAmount,
          paymentMethod: 'ONLINE',
          paymentDate: new Date(),
          transactionId: result.transactionId,
          status: 'COMPLETED',
          gateway: provider,
          gatewayOrderId: orderId,
          gatewayPaymentId: paymentId,
          gatewayStatus: result.status,
          notes: `Online payment via ${gatewayResult.credentials.provider}`,
        },
      })
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: Math.max(0, newBalance),
          status: newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID',
        },
      })
      return created
    })

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        paymentNo: payment.paymentNo,
        amount: paymentAmount,
        transactionId: result.transactionId,
        status: 'COMPLETED',
      },
    })
  } catch (err: unknown) {
    console.error('Payment verification error:', err)
    if (err instanceof Error && err.message === 'PAYMENT_ALREADY_PROCESSED') {
      return NextResponse.json({ error: 'Payment already processed' }, { status: 409 })
    }
    const message = err instanceof Error ? err.message : 'Payment verification failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
