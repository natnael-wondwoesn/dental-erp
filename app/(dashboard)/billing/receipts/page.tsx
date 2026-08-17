'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Eye, ReceiptText, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ExportMenu } from '@/components/ui/export-menu'
import { ErpModuleOverview } from '@/components/dashboard/erp-overview'
import { formatCurrency, formatDate } from '@/lib/i18n/format'

type PaymentRow = {
  id: string
  paymentNo: string
  amount: number | string
  paymentMethod: string
  paymentDate: string
  status: string
  transactionId: string | null
  invoice: {
    id: string
    invoiceNo: string
    patient: {
      id: string
      patientId: string
      firstName: string
      lastName: string
    }
  }
}

type PaymentResponse = {
  payments: PaymentRow[]
  summary: {
    totalReceived: number
    totalRefunded: number
  }
}

function receiptNumber(prefix: string, paymentNo: string) {
  return `${prefix}-${paymentNo}`
}

export default function ReceiptsPage() {
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [search, setSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('all')
  const [receiptPrefix, setReceiptPrefix] = useState('REC')
  const [summary, setSummary] = useState({ totalReceived: 0, totalRefunded: 0 })

  const fetchReceipts = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        status: 'COMPLETED',
        limit: '100',
      })

      if (search) params.append('search', search)
      if (paymentMethod !== 'all') params.append('paymentMethod', paymentMethod)

      const [paymentsRes, settingsRes] = await Promise.all([
        fetch(`/api/payments?${params}`),
        fetch('/api/settings?category=billing'),
      ])

      if (!paymentsRes.ok) throw new Error('Failed to fetch receipts')
      const paymentsData = (await paymentsRes.json()) as PaymentResponse
      setPayments(paymentsData.payments)
      setSummary(paymentsData.summary)

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        const prefixSetting = settingsData.data?.find((item: { key: string; value: string }) => item.key === 'receiptPrefix')
        if (prefixSetting?.value) setReceiptPrefix(prefixSetting.value)
      }
    } finally {
      setLoading(false)
    }
  }, [paymentMethod, search])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchReceipts()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchReceipts])

  return (
    <div className="space-y-6">
      <ErpModuleOverview
        moduleId="billing"
        eyebrow="Receipts ERP"
        title="Receipts that close the loop from collection to patient proof"
        description="Every completed collection can be traced back to the invoice, patient, method, and printed acknowledgment from one receipts workspace."
        compact
        showActions={false}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Receipts</h1>
          <p className="text-muted-foreground">
            Trace completed collections to printable patient receipts.
          </p>
        </div>
        <ExportMenu
          filename="receipts"
          getData={() =>
            payments.map((payment) => ({
              Receipt: receiptNumber(receiptPrefix, payment.paymentNo),
              Payment: payment.paymentNo,
              Patient: `${payment.invoice.patient.firstName} ${payment.invoice.patient.lastName}`,
              'Patient ID': payment.invoice.patient.patientId,
              Invoice: payment.invoice.invoiceNo,
              Date: payment.paymentDate,
              Method: payment.paymentMethod,
              Amount: Number(payment.amount),
            }))
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed receipts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{payments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Collected amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-green-600">
              {formatCurrency(summary.totalReceived)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Refunded amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-red-600">
              {formatCurrency(summary.totalRefunded)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by patient, invoice, or payment number..."
                className="pl-9"
              />
            </div>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="CARD">Card</SelectItem>
                <SelectItem value="UPI">Mobile money</SelectItem>
                <SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem>
                <SelectItem value="CHEQUE">Cheque</SelectItem>
                <SelectItem value="INSURANCE">Insurance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-9 w-9" /></TableCell>
                  </TableRow>
                ))
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <ReceiptText className="h-6 w-6" />
                      No receipts match the current filters.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {receiptNumber(receiptPrefix, payment.paymentNo)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {payment.invoice.patient.firstName} {payment.invoice.patient.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {payment.invoice.patient.patientId}
                      </div>
                    </TableCell>
                    <TableCell>{payment.invoice.invoiceNo}</TableCell>
                    <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                    <TableCell>{payment.paymentMethod.replaceAll('_', ' ')}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/billing/receipts/${payment.id}`}>
                        <Button variant="outline" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
