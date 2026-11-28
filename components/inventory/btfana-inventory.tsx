'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FileText, Loader2, MinusCircle, Package, Plus, Search } from 'lucide-react'
import { validateUsageQuantity } from '@/lib/inventory-usage'

interface Item {
  id: string
  sku: string
  name: string
  itemType: string
  categoryName: string
  currentStock: number
  minimumStock: number
  unit: string
  purchasePrice: number
  stockStatus: 'out_of_stock' | 'low_stock' | 'reorder' | 'sufficient'
}

interface UsageEntry {
  id: string
  itemId: string
  itemName: string
  sku: string
  quantity: number
  newStock: number
  notes: string | null
  performedByName: string | null
  transactionDate: string
}

const STATUS_CONFIG = {
  out_of_stock: { label: 'Out of Stock', className: 'bg-red-100 text-red-700' },
  low_stock: { label: 'Low Stock', className: 'bg-orange-100 text-orange-700' },
  reorder: { label: 'Reorder', className: 'bg-yellow-100 text-yellow-700' },
  sufficient: { label: 'Sufficient', className: 'bg-green-100 text-green-700' },
}

const formatItemType = (type: string) =>
  type
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0)

export function BtfanaInventory() {
  const [items, setItems] = useState<Item[]>([])
  const [usage, setUsage] = useState<UsageEntry[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [usageLoading, setUsageLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [useTarget, setUseTarget] = useState<Item | null>(null)
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    try {
      // Fetch the whole list; search and filters are applied client-side for instant feedback.
      const response = await fetch('/api/inventory/items?limit=1000&status=active')
      if (!response.ok) throw new Error('Failed to fetch inventory items')
      const data = await response.json()
      setItems(data.data)
    } catch (error) {
      console.error('Error fetching inventory items:', error)
    } finally {
      setItemsLoading(false)
    }
  }, [])

  const fetchUsage = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        date: 'today',
        type: 'CONSUMPTION',
        limit: '200',
        tzOffset: String(new Date().getTimezoneOffset()),
      })
      const response = await fetch(`/api/inventory/transactions?${params}`)
      if (!response.ok) throw new Error('Failed to fetch today usage')
      const data = await response.json()
      setUsage(data.data)
    } catch (error) {
      console.error('Error fetching today usage:', error)
    } finally {
      setUsageLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
    fetchUsage()
  }, [fetchItems, fetchUsage])

  const query = search.trim().toLowerCase()
  const filteredItems = items.filter(
    (item) =>
      (!query ||
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query)) &&
      (typeFilter === 'all' || item.itemType === typeFilter) &&
      (statusFilter === 'all' || item.stockStatus === statusFilter)
  )

  const openUseDialog = (item: Item) => {
    setUseTarget(item)
    setQuantity('')
    setNote('')
    setFormError(null)
  }

  const submitUsage = async () => {
    if (!useTarget) return
    const qty = Number(quantity)
    const validation = validateUsageQuantity(qty, useTarget.currentStock)
    if (validation) {
      setFormError(validation)
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      const response = await fetch('/api/inventory/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CONSUMPTION',
          itemId: useTarget.id,
          quantity: qty,
          transactionDate: new Date().toISOString(),
          notes: note.trim() || undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setFormError(data.error || 'Failed to record usage')
        return
      }
      setUseTarget(null)
      // Refresh both tabs so stock, status and today's log stay in step.
      await Promise.all([fetchItems(), fetchUsage()])
    } catch {
      setFormError('Failed to record usage')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Track stock and record daily item usage</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/inventory/reports">
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Reports
            </Button>
          </Link>
          <Link href="/inventory/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Item
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="today" className="space-y-4">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Quantity Used</TableHead>
                    <TableHead>Remaining Stock</TableHead>
                    <TableHead>Recorded By</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : usage.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No items used today
                      </TableCell>
                    </TableRow>
                  ) : (
                    usage.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="font-medium">{entry.itemName}</div>
                          <div className="text-xs text-muted-foreground">{entry.sku}</div>
                        </TableCell>
                        <TableCell className="font-medium">{entry.quantity}</TableCell>
                        <TableCell>{entry.newStock}</TableCell>
                        <TableCell>{entry.performedByName || '-'}</TableCell>
                        <TableCell>
                          {new Date(entry.transactionDate).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or item code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="DENTAL_MATERIAL">Dental Material</SelectItem>
                      <SelectItem value="INSTRUMENT">Instrument</SelectItem>
                      <SelectItem value="CONSUMABLE">Consumable</SelectItem>
                      <SelectItem value="MEDICINE">Medicine</SelectItem>
                      <SelectItem value="OFFICE_SUPPLY">Office Supply</SelectItem>
                      <SelectItem value="EQUIPMENT">Equipment</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Stock status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stock Levels</SelectItem>
                      <SelectItem value="sufficient">Sufficient</SelectItem>
                      <SelectItem value="reorder">Reorder</SelectItem>
                      <SelectItem value="low_stock">Low Stock</SelectItem>
                      <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-[850px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Stock Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={8}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Package className="h-8 w-8 text-muted-foreground" />
                          <p className="text-muted-foreground">No inventory items found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => {
                      const status = STATUS_CONFIG[item.stockStatus] || STATUS_CONFIG.sufficient
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.sku}</TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-sm">
                            {item.categoryName || 'Uncategorized'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{formatItemType(item.itemType)}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.currentStock} {item.unit}
                          </TableCell>
                          <TableCell>{formatCurrency(item.purchasePrice)}</TableCell>
                          <TableCell>
                            <Badge className={`${status.className} border-0`}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={item.currentStock <= 0}
                              onClick={() => openUseDialog(item)}
                            >
                              <MinusCircle className="h-4 w-4 mr-2" />
                              Use item
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!useTarget}
        onOpenChange={(open) => !open && !submitting && setUseTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Use item</DialogTitle>
            <DialogDescription>
              {useTarget?.name} - {useTarget?.currentStock} {useTarget?.unit} in stock
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="usage-quantity">Quantity Used</Label>
              <Input
                id="usage-quantity"
                type="number"
                min={1}
                max={useTarget?.currentStock}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="usage-note">Note / Usage reason (optional)</Label>
              <Textarea id="usage-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUseTarget(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submitUsage} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
