'use client'

import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { ArrowLeft, Printer, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/i18n/format'

type PaymentDetail = {
  id: string
  paymentNo: string
  amount: number | string
  paymentMethod: string
  paymentDate: string
  status: string
  transactionId: string | null
  notes: string | null
  refundAmount: number | string | null
  refundDate: string | null
  invoice: {
    id: string
    invoiceNo: string
    totalAmount: number | string
    paidAmount: number | string
    balanceAmount: number | string
    status: string
    patient: {
      id: string
      patientId: string
      firstName: string
      lastName: string
      phone: string
      email: string | null
    }
  }
}

function receiptNumber(prefix: string, paymentNo: string) {
  return `${prefix}-${paymentNo}`
}

export default function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [loading, setLoading] = useState(true)
  const [payment, setPayment] = useState<PaymentDetail | null>(null)
  const [receiptPrefix, setReceiptPrefix] = useState('REC')

  useEffect(() => {
    async function fetchReceipt() {
      try {
        setLoading(true)
        const [paymentRes, settingsRes] = await Promise.all([
          fetch(`/api/payments/${id}`),
          fetch('/api/settings?category=billing'),
        ])

        if (!paymentRes.ok) throw new Error('Failed to load receipt')
        setPayment((await paymentRes.json()) as PaymentDetail)

        if (settingsRes.ok) {
          const settingsData = await settingsRes.json()
          const prefixSetting = settingsData.data?.find((item: { key: string; value: string }) => item.key === 'receiptPrefix')
          if (prefixSetting?.value) setReceiptPrefix(prefixSetting.value)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchReceipt()
  }, [id])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-[720px]" />
      </div>
    )
  }

  if (!payment) {
    return <div className="text-sm text-muted-foreground">Receipt not found.</div>
  }

  const receiptNo = receiptNumber(receiptPrefix, payment.paymentNo)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            href="/billing/receipts"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to receipts
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{receiptNo}</h1>
          <p className="text-muted-foreground">
            Receipt for invoice {payment.invoice.invoiceNo} issued on {formatDate(payment.paymentDate)}
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print receipt
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5" />
              Receipt summary
            </CardTitle>
          </div>
          <Badge variant="outline">{payment.status}</Badge>
        </CardHeader>
        <CardContent className="grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">Patient</div>
                <div className="mt-1 font-semibold">
                  {payment.invoice.patient.firstName} {payment.invoice.patient.lastName}
                </div>
                <div className="text-sm text-muted-foreground">{payment.invoice.patient.patientId}</div>
                <div className="text-sm text-muted-foreground">{payment.invoice.patient.phone}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">Invoice</div>
                <div className="mt-1 font-semibold">{payment.invoice.invoiceNo}</div>
                <div className="text-sm text-muted-foreground">Status: {payment.invoice.status}</div>
                <Link href={`/billing/invoices/${payment.invoice.id}`} className="text-sm text-primary">
                  Open invoice
                </Link>
              </div>
            </div>

            <div className="rounded-lg border">
              <div className="grid gap-4 p-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground">Receipt number</div>
                  <div className="font-medium">{receiptNo}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Payment reference</div>
                  <div className="font-medium">{payment.paymentNo}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Payment method</div>
                  <div className="font-medium">{payment.paymentMethod.replaceAll('_', ' ')}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Paid at</div>
                  <div className="font-medium">{formatDateTime(payment.paymentDate)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Transaction ID</div>
                  <div className="font-medium">{payment.transactionId || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Notes</div>
                  <div className="font-medium">{payment.notes || 'No payment notes'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/20 p-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Invoice total</span>
                <span>{formatCurrency(payment.invoice.totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount paid</span>
                <span className="font-semibold text-green-600">{formatCurrency(payment.amount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Invoice paid to date</span>
                <span>{formatCurrency(payment.invoice.paidAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Outstanding balance</span>
                <span>{formatCurrency(payment.invoice.balanceAmount)}</span>
              </div>
              {payment.refundAmount && Number(payment.refundAmount) > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Refunded</span>
                  <span className="text-red-600">
                    {formatCurrency(payment.refundAmount)}
                    {payment.refundDate ? ` on ${formatDate(payment.refundDate)}` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
