'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Smile } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface BracesRow {
  id: string
  patientId: string
  bracesType: string | null
  severity: string | null
  planStatus: string
  estimatedMonths: number | null
  removalDate: string | null
  patient: { patientId: string; firstName: string; lastName: string; phone: string }
  visits: { visitDate: string; nextAppointment: string | null }[]
}

interface PatientHit {
  id: string
  patientId: string
  firstName: string
  lastName: string
  phone: string
}

const STATUSES = ['ALL', 'DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED'] as const
const label = (value: string) =>
  value === 'ALL' ? 'All' : value.charAt(0) + value.slice(1).toLowerCase().replace('_', ' ')
const day = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : '-')

export default function BracesPage() {
  const [rows, setRows] = useState<BracesRow[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('ALL')
  const [finder, setFinder] = useState('')
  const [hits, setHits] = useState<PatientHit[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    if (status !== 'ALL') params.set('status', status)
    try {
      const res = await fetch(`/api/braces?${params}`)
      if (!res.ok) throw new Error('failed')
      setRows((await res.json()).cases ?? [])
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  // Starting a case: find the patient, then open that patient's braces record.
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (finder.trim().length < 2) {
        setHits([])
        return
      }
      try {
        const res = await fetch(`/api/patients?limit=6&search=${encodeURIComponent(finder.trim())}`)
        if (res.ok) setHits((await res.json()).patients ?? [])
      } catch {
        setHits([])
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [finder])

  const count = (s: string) => rows.filter((r) => r.planStatus === s).length

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--clinic-color,#0769e7)] text-white">
          <Smile className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Braces</h1>
          <p className="text-sm text-muted-foreground">
            Orthodontic assessment, treatment plan, visits and retention for every braces patient.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {(['DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED'] as const).map((s) => (
          <Card key={s}>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">{label(s)}</div>
              <div className="text-2xl font-semibold">{loading ? '-' : count(s)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" /> Start braces for a patient
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder="Search a patient by name, number or phone"
            value={finder}
            onChange={(e) => setFinder(e.target.value)}
          />
          {hits.map((p) => (
            <Link
              key={p.id}
              href={`/patients/${p.id}/braces`}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted"
            >
              <span className="font-medium">
                {p.firstName} {p.lastName}
              </span>
              <span className="text-muted-foreground">
                {p.patientId} · {p.phone}
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Braces patients</CardTitle>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name, number or phone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={status === s ? 'default' : 'outline'}
                  onClick={() => setStatus(s)}
                >
                  {label(s)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : failed ? (
            <p className="py-8 text-center text-sm text-destructive">
              Could not load braces patients. Please refresh.
            </p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No braces patients yet. Use “Start braces for a patient” above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Last visit</TableHead>
                  <TableHead>Next visit</TableHead>
                  <TableHead>Removal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        href={`/patients/${r.patientId}/braces`}
                        className="font-medium text-[#086be6] hover:underline"
                      >
                        {r.patient.firstName} {r.patient.lastName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {r.patient.patientId} · {r.patient.phone}
                      </div>
                    </TableCell>
                    <TableCell>{r.bracesType ? label(r.bracesType) : '-'}</TableCell>
                    <TableCell>{r.severity ? label(r.severity) : '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{label(r.planStatus)}</Badge>
                    </TableCell>
                    <TableCell>{day(r.visits[0]?.visitDate)}</TableCell>
                    <TableCell>{day(r.visits[0]?.nextAppointment)}</TableCell>
                    <TableCell>{day(r.removalDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
