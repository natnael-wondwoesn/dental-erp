'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ScanLine, Search } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

interface Row {
  id: string
  patientId: string
  patient: { patientId: string; firstName: string; lastName: string; phone: string }
}

export default function ImagingIndexPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true)
      setFailed(false)
      try {
        const res = await fetch(`/api/braces?search=${encodeURIComponent(search.trim())}`)
        if (!res.ok) throw new Error('failed')
        setRows((await res.json()).cases ?? [])
      } catch {
        setFailed(true)
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--clinic-color,#0769e7)] text-white">
          <ScanLine className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Orthodontic Imaging</h1>
          <p className="text-sm text-muted-foreground">
            Choose a braces patient to open their clinical image workspace.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Patients</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, number or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : failed ? (
            <p className="py-6 text-center text-sm text-destructive">
              Could not load patients. Please refresh.
            </p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No braces patients found. Start a braces case first from the Braces page.
            </p>
          ) : (
            rows.map((r) => (
              <Link
                key={r.id}
                href={`/patients/${r.patientId}/imaging`}
                className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted"
              >
                <span className="font-medium">
                  {r.patient.firstName} {r.patient.lastName}
                </span>
                <span className="text-muted-foreground">
                  {r.patient.patientId} · {r.patient.phone}
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
