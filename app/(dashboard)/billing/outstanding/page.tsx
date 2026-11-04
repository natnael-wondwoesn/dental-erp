'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDate, invoiceStatusConfig } from '@/lib/billing-utils'

interface PatientBalance {
  patient: { id: string; patientId: string; name: string; phone: string }
  invoiceCount: number
  overdueCount: number
  totalBilled: number
  totalPaid: number
  totalOutstanding: number
  oldestInvoiceAt: string
}

interface BalanceResponse {
  patients: PatientBalance[]
  totals: { patientCount: number; invoiceCount: number; totalOutstanding: number }
}

interface OpenInvoice {
  id: string
  invoiceNo: string
  status: string
  totalAmount: number | string
  paidAmount: number | string
  balanceAmount: number | string
  createdAt: string
}

export default function OutstandingBalancesPage() {
  const [data, setData] = useState<BalanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<Record<string, OpenInvoice[]>>({})
  const [loadingInvoices, setLoadingInvoices] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/billing/outstanding-balances')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.patients ?? []).filter(
      (p) =>
        !q ||
        p.patient.name.toLowerCase().includes(q) ||
        p.patient.patientId.toLowerCase().includes(q) ||
        p.patient.phone.includes(q)
    )
  }, [data, search])

  const toggle = async (patientDbId: string) => {
    if (openId === patientDbId) return setOpenId(null)
    setOpenId(patientDbId)
    if (invoices[patientDbId]) return
    setLoadingInvoices(patientDbId)
    try {
      const res = await fetch(`/api/billing/patient-outstanding?patientId=${patientDbId}`)
      const result = await res.json()
      setInvoices((prev) => ({ ...prev, [patientDbId]: result.invoices || [] }))
    } catch {
      setInvoices((prev) => ({ ...prev, [patientDbId]: [] }))
    }
    setLoadingInvoices(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild aria-label="Back to billing">
            <Link href="/billing">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Outstanding Balances</h1>
            <p className="text-muted-foreground">
              One summary per patient. Open a patient to see their individual invoices.
            </p>
          </div>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search patient, ID or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total outstanding</CardDescription>
            <CardTitle>{formatCurrency(data?.totals.totalOutstanding ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Patients with a balance</CardDescription>
            <CardTitle>{data?.totals.patientCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open invoices</CardDescription>
            <CardTitle>{data?.totals.invoiceCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-10">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : failed ? (
            <p className="p-6 text-sm text-destructive">Could not load outstanding balances.</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No outstanding balances found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="w-8 p-3" />
                    <th className="p-3">Patient</th>
                    <th className="p-3 text-right">Invoices</th>
                    <th className="p-3 text-right">Billed</th>
                    <th className="p-3 text-right">Paid</th>
                    <th className="p-3 text-right">Outstanding</th>
                    <th className="p-3">Oldest invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const open = openId === row.patient.id
                    return (
                      <Fragment key={row.patient.id}>
                        <tr
                          className="cursor-pointer border-b hover:bg-accent/50"
                          onClick={() => toggle(row.patient.id)}
                        >
                          <td className="p-3">
                            {open ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-medium">{row.patient.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.patient.patientId} · {row.patient.phone}
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            {row.invoiceCount}
                            {row.overdueCount > 0 && (
                              <Badge variant="destructive" className="ml-2">
                                {row.overdueCount} overdue
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">{formatCurrency(row.totalBilled)}</td>
                          <td className="p-3 text-right">{formatCurrency(row.totalPaid)}</td>
                          <td className="p-3 text-right font-semibold">
                            {formatCurrency(row.totalOutstanding)}
                          </td>
                          <td className="p-3">{formatDate(row.oldestInvoiceAt)}</td>
                        </tr>
                        {open && (
                          <tr className="border-b bg-muted/30">
                            <td />
                            <td colSpan={6} className="p-3">
                              {loadingInvoices === row.patient.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <table className="w-full text-sm">
                                  <thead className="text-left text-muted-foreground">
                                    <tr>
                                      <th className="py-1">Invoice</th>
                                      <th className="py-1">Date</th>
                                      <th className="py-1">Status</th>
                                      <th className="py-1 text-right">Total</th>
                                      <th className="py-1 text-right">Paid</th>
                                      <th className="py-1 text-right">Balance</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(invoices[row.patient.id] ?? []).map((inv) => (
                                      <tr key={inv.id}>
                                        <td className="py-1">
                                          <Link
                                            href={`/billing/invoices/${inv.id}`}
                                            className="font-medium text-primary hover:underline"
                                          >
                                            {inv.invoiceNo}
                                          </Link>
                                        </td>
                                        <td className="py-1">{formatDate(inv.createdAt)}</td>
                                        <td className="py-1">
                                          {invoiceStatusConfig[
                                            inv.status as keyof typeof invoiceStatusConfig
                                          ]?.label ?? inv.status}
                                        </td>
                                        <td className="py-1 text-right">
                                          {formatCurrency(inv.totalAmount)}
                                        </td>
                                        <td className="py-1 text-right">
                                          {formatCurrency(inv.paidAmount)}
                                        </td>
                                        <td className="py-1 text-right font-medium">
                                          {formatCurrency(inv.balanceAmount)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
