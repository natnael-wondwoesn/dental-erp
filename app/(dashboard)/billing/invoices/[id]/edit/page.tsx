'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, Lock, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { calculateInvoiceTotals, formatCurrency } from '@/lib/billing-utils'

interface EditItem {
  key: string
  treatmentId: string | null
  description: string
  quantity: number
  unitPrice: number
  taxable: boolean
}

interface UnbilledTreatment {
  treatmentId: string
  treatmentNo: string
  description: string
  doctor: string | null
  unitPrice: number
  taxable: boolean
}

interface LoadedInvoice {
  id: string
  invoiceNo: string
  status: string
  patientId: string
  patient: { firstName: string; lastName: string; patientId: string; phone: string | null }
  items: Array<{
    id: string
    treatmentId: string | null
    description: string
    quantity: number | string
    unitPrice: number | string
    taxable: boolean
  }>
  payments: Array<{ status: string }>
  discountType: 'PERCENTAGE' | 'FIXED' | null
  discountValue: number | string | null
  cgstRate: number | string
  sgstRate: number | string
  paidAmount: number | string
  dueDate: string | null
  notes: string | null
  termsAndConditions: string | null
}

const FINAL = ['PAID', 'CANCELLED', 'REFUNDED']
let keyCounter = 0
const nextKey = () => `item-${++keyCounter}`

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [invoice, setInvoice] = useState<LoadedInvoice | null>(null)
  const [items, setItems] = useState<EditItem[]>([])
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('FIXED')
  const [discountValue, setDiscountValue] = useState(0)
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('')
  const [unbilled, setUnbilled] = useState<UnbilledTreatment[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/invoices/${id}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Could not load the invoice')
        if (cancelled) return
        const inv = data as LoadedInvoice
        setInvoice(inv)
        setItems(
          inv.items.map((i) => ({
            key: nextKey(),
            treatmentId: i.treatmentId,
            description: i.description,
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
            taxable: i.taxable,
          }))
        )
        setDiscountType(inv.discountType ?? 'FIXED')
        setDiscountValue(Number(inv.discountValue ?? 0))
        setDueDate(inv.dueDate ? inv.dueDate.slice(0, 10) : '')
        setNotes(inv.notes ?? '')
        setTerms(inv.termsAndConditions ?? '')
        const pending = await fetch(`/api/billing/unbilled-treatments?patientId=${inv.patientId}`)
        if (pending.ok) {
          const list = await pending.json()
          if (!cancelled) setUnbilled(list.treatments ?? [])
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the invoice')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  const locked = useMemo(
    () => (invoice ? invoice.payments.some((p) => p.status === 'COMPLETED') : false),
    [invoice]
  )
  const final = invoice ? FINAL.includes(invoice.status) : false

  const totals = useMemo(
    () =>
      calculateInvoiceTotals(
        items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxable: i.taxable })),
        discountType,
        discountValue,
        Number(invoice?.cgstRate ?? 15),
        Number(invoice?.sgstRate ?? 0)
      ),
    [items, discountType, discountValue, invoice]
  )

  const update = (key: string, patch: Partial<EditItem>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  const addCustom = () =>
    setItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        treatmentId: null,
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxable: false,
      },
    ])

  const addTreatment = (t: UnbilledTreatment) => {
    setItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        treatmentId: t.treatmentId,
        description: t.description,
        quantity: 1,
        unitPrice: t.unitPrice,
        taxable: t.taxable,
      },
    ])
    setUnbilled((prev) => prev.filter((x) => x.treatmentId !== t.treatmentId))
  }

  const removeItem = (item: EditItem) => {
    setItems((prev) => prev.filter((i) => i.key !== item.key))
    // A treatment taken off the invoice goes back to the list of unbilled work.
    if (item.treatmentId) {
      setUnbilled((prev) =>
        prev.some((x) => x.treatmentId === item.treatmentId)
          ? prev
          : [
              ...prev,
              {
                treatmentId: item.treatmentId!,
                treatmentNo: '',
                description: item.description,
                doctor: null,
                unitPrice: item.unitPrice,
                taxable: item.taxable,
              },
            ]
      )
    }
  }

  async function save() {
    setError('')
    if (!locked) {
      if (items.length === 0) return setError('An invoice needs at least one item')
      if (items.some((i) => !i.description.trim()))
        return setError('Every item needs a description')
      if (items.some((i) => !(i.quantity > 0))) return setError('Quantity must be more than zero')
      if (items.some((i) => i.unitPrice < 0)) return setError('Price cannot be negative')
      if (discountType === 'PERCENTAGE' && discountValue > 100)
        return setError('A percentage discount cannot be more than 100')
      if (totals.totalAmount < Number(invoice?.paidAmount ?? 0))
        return setError('The new total cannot be lower than the amount already paid')
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(locked
            ? {}
            : {
                items: items.map((i) => ({
                  treatmentId: i.treatmentId,
                  description: i.description.trim(),
                  quantity: i.quantity,
                  unitPrice: i.unitPrice,
                  taxable: i.taxable,
                })),
                discountType,
                discountValue,
              }),
          dueDate: dueDate || null,
          notes,
          termsAndConditions: terms,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save the invoice')
      router.push(`/billing/invoices/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the invoice')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading invoice…</div>
  if (!invoice)
    return (
      <div className="p-6 space-y-3">
        <p className="text-red-600">{error || 'Invoice not found'}</p>
        <Button variant="outline" asChild>
          <Link href="/billing/invoices">Back to invoices</Link>
        </Button>
      </div>
    )

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/billing/invoices/${id}`} aria-label="Back to the invoice">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit {invoice.invoiceNo}</h1>
          <p className="text-sm text-muted-foreground">
            {invoice.patient.firstName} {invoice.patient.lastName} · {invoice.patient.patientId}
          </p>
        </div>
        <Badge variant="outline" className="ml-auto">
          {invoice.status.replace('_', ' ')}
        </Badge>
      </div>

      {final && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <Lock className="mt-0.5 h-4 w-4" />
          <p>This invoice is {invoice.status.toLowerCase()} and can no longer be edited.</p>
        </div>
      )}
      {!final && locked && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <Lock className="mt-0.5 h-4 w-4" />
          <p>
            A payment has been recorded on this invoice, so the items and prices are locked. You can
            still change the due date, notes and terms.
          </p>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <p>{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Invoice items</CardTitle>
          <CardDescription>Change what is charged on this invoice.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <div
              key={item.key}
              className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_90px_130px_90px_auto] sm:items-end"
            >
              <div className="space-y-1">
                <Label>Description</Label>
                <Input
                  value={item.description}
                  disabled={locked || final}
                  onChange={(e) => update(item.key, { description: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Qty</Label>
                <Input
                  type="number"
                  min={1}
                  step="any"
                  value={item.quantity}
                  disabled={locked || final}
                  onChange={(e) => update(item.key, { quantity: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label>Unit price (ETB)</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={item.unitPrice}
                  disabled={locked || final}
                  onChange={(e) => update(item.key, { unitPrice: Number(e.target.value) })}
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Checkbox
                  checked={item.taxable}
                  disabled={locked || final}
                  onCheckedChange={(v) => update(item.key, { taxable: v === true })}
                />
                Taxable
              </label>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <span className="text-sm font-medium">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={locked || final}
                  aria-label={`Remove ${item.description || 'item'}`}
                  onClick={() => removeItem(item)}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
          {!locked && !final && (
            <Button type="button" variant="outline" size="sm" onClick={addCustom}>
              <Plus className="mr-1 h-4 w-4" /> Add custom item
            </Button>
          )}
        </CardContent>
      </Card>

      {!locked && !final && unbilled.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Treatments not yet billed</CardTitle>
            <CardDescription>
              Add this patient&apos;s other treatments to the invoice.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {unbilled.map((t) => (
              <div
                key={t.treatmentId}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{t.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.treatmentNo}
                    {t.doctor ? ` · ${t.doctor}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm">{formatCurrency(t.unitPrice)}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => addTreatment(t)}>
                    <Plus className="mr-1 h-4 w-4" /> Add
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Discount, due date and notes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Discount</Label>
            <div className="flex gap-2">
              <Select
                value={discountType}
                disabled={locked || final}
                onValueChange={(v) => setDiscountType(v as 'PERCENTAGE' | 'FIXED')}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">ETB</SelectItem>
                  <SelectItem value="PERCENTAGE">%</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                step="any"
                value={discountValue}
                disabled={locked || final}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="due">Due date</Label>
            <Input
              id="due"
              type="date"
              value={dueDate}
              disabled={final}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="notes">Notes (visible on the invoice)</Label>
            <Textarea
              id="notes"
              rows={3}
              value={notes}
              disabled={final}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="terms">Terms and conditions</Label>
            <Textarea
              id="terms"
              rows={3}
              value={terms}
              disabled={final}
              onChange={(e) => setTerms(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>
          {totals.discountAmount > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>-{formatCurrency(totals.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>VAT</span>
            <span>{formatCurrency(totals.cgstAmount + totals.sgstAmount)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(totals.totalAmount)}</span>
          </div>
          {Number(invoice.paidAmount) > 0 && (
            <>
              <div className="flex justify-between">
                <span>Already paid</span>
                <span>{formatCurrency(Number(invoice.paidAmount))}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Balance due</span>
                <span>{formatCurrency(totals.totalAmount - Number(invoice.paidAmount))}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href={`/billing/invoices/${id}`}>Cancel</Link>
        </Button>
        <Button onClick={save} disabled={saving || final}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}
