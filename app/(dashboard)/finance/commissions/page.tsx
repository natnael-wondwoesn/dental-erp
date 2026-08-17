'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Loader2, Percent, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ExportMenu } from '@/components/ui/export-menu'
import { ErpModuleOverview } from '@/components/dashboard/erp-overview'
import { useToast } from '@/hooks/use-toast'

type CommissionResponse = {
  currency: string
  period: { start: string; end: string }
  config: {
    defaultRate: number
    categoryRates: Record<string, number>
  }
  categories: string[]
  summary: {
    totalRevenue: number
    totalCommission: number
    totalTreatments: number
    doctorCount: number
    averageEffectiveRate: number
  }
  doctors: Array<{
    id: string
    employeeId: string
    name: string
    specialization: string | null
    treatmentCount: number
    revenue: number
    commission: number
    effectiveRate: number
    categories: Array<{
      category: string
      count: number
      revenue: number
      commission: number
      rate: number
    }>
  }>
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export default function CommissionsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<CommissionResponse | null>(null)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(1)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [defaultRate, setDefaultRate] = useState('12')
  const [categoryRates, setCategoryRates] = useState<Record<string, string>>({})

  const fetchCommissions = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ startDate, endDate })
      const response = await fetch(`/api/finance/commissions?${params}`)
      if (!response.ok) throw new Error('Failed to fetch commission data')
      const result = (await response.json()) as CommissionResponse
      setData(result)
      setDefaultRate(String(result.config.defaultRate))
      setCategoryRates(
        Object.fromEntries(
          result.categories.map((category) => [
            category,
            String(result.config.categoryRates[category] ?? result.config.defaultRate),
          ])
        )
      )
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to load commissions',
        description: error.message,
      })
    } finally {
      setLoading(false)
    }
  }, [endDate, startDate, toast])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchCommissions()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchCommissions])

  const saveConfig = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/finance/commissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultRate,
          categoryRates,
        }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Failed to save commission settings')
      }

      toast({ title: 'Commission settings updated' })
      void fetchCommissions()
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: error.message,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <ErpModuleOverview
        moduleId="finance"
        eyebrow="Commission ERP"
        title="Commission rules tied directly to completed clinical revenue"
        description="Configure payout percentages by procedure category and review doctor-level commission statements from the same posted treatment and billing data."
        compact
        showActions={false}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dentist commissions</h1>
          <p className="text-muted-foreground">
            Configure payable rates and review doctor-level commission statements from completed procedures.
          </p>
        </div>
        <ExportMenu
          filename="dentist-commissions"
          getData={() =>
            (data?.doctors || []).map((doctor) => ({
              Doctor: doctor.name,
              Employee: doctor.employeeId,
              Specialization: doctor.specialization || '',
              Treatments: doctor.treatmentCount,
              Revenue: doctor.revenue,
              Commission: doctor.commission,
              'Effective Rate': doctor.effectiveRate,
            }))
          }
        />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="md:w-[180px]" />
        <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="md:w-[180px]" />
        <Button onClick={fetchCommissions} variant="outline">
          Refresh range
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28" />)
          : [
              ['Doctors', String(data?.summary.doctorCount || 0)],
              ['Completed procedures', String(data?.summary.totalTreatments || 0)],
              ['Revenue basis', money(data?.summary.totalRevenue || 0, data?.currency || 'ETB')],
              ['Commission payable', money(data?.summary.totalCommission || 0, data?.currency || 'ETB')],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{value}</div>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Commission rules</CardTitle>
            <CardDescription>
              Default and category overrides used to derive commission from completed treatment revenue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default rate</Label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  value={defaultRate}
                  onChange={(event) => setDefaultRate(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {Object.entries(categoryRates).map(([category, rate]) => (
              <div key={category} className="space-y-2">
                <Label>{category.replaceAll('_', ' ')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={rate}
                  onChange={(event) =>
                    setCategoryRates((current) => ({ ...current, [category]: event.target.value }))
                  }
                />
              </div>
            ))}
            <Button onClick={saveConfig} disabled={saving} className="w-full">
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save commission rules
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Doctor statements</CardTitle>
            <CardDescription>
              Range: {data?.period.start || startDate} to {data?.period.end || endDate}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Treatments</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Effective rate</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : !data || data.doctors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No commission-bearing treatments were completed in this range.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.doctors.map((doctor) => (
                    <TableRow key={doctor.id}>
                      <TableCell>
                        <div className="font-medium">{doctor.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {doctor.employeeId}
                          {doctor.specialization ? ` · ${doctor.specialization}` : ''}
                        </div>
                      </TableCell>
                      <TableCell>{doctor.treatmentCount}</TableCell>
                      <TableCell>{money(doctor.revenue, data.currency)}</TableCell>
                      <TableCell className="font-medium">{money(doctor.commission, data.currency)}</TableCell>
                      <TableCell>{doctor.effectiveRate}%</TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/staff/${doctor.id}/performance?startDate=${startDate}&endDate=${endDate}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary"
                        >
                          Review <ArrowRight className="h-4 w-4" />
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
    </div>
  )
}
