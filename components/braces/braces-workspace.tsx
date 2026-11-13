'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { AssessmentTab } from './assessment-tab'
import { DocumentsTab } from './documents-tab'
import { OverviewTab } from './overview-tab'
import { PlanTab } from './plan-tab'
import { RecordsTab } from './records-tab'
import { RetentionTab } from './retention-tab'
import type { Billing, BracesData, Doctor, PatientInfo, WorkspaceCtx } from './shared'
import { TrackingTab } from './tracking-tab'
import { VisitsTab } from './visits-tab'

const TABS = [
  ['overview', 'Case overview'],
  ['assessment', 'Assessment'],
  ['records', 'Dental records'],
  ['plan', 'Treatment plan'],
  ['visits', 'Progress & visits'],
  ['tracking', 'Progress tracking'],
  ['retention', 'Retention'],
  ['documents', 'Documents & forms'],
] as const

export function BracesWorkspace({ patientId }: { patientId: string }) {
  const [tab, setTab] = useState('overview')
  const [data, setData] = useState<BracesData | null>(null)
  const [billing, setBilling] = useState<Billing | null>(null)
  const [patient, setPatient] = useState<PatientInfo | null>(null)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  const reload = useCallback(async () => {
    const res = await fetch(`/api/patients/${patientId}/braces`)
    if (res.ok) {
      const body = await res.json()
      setData(body.bracesCase)
      setBilling(body.billing ?? null)
      // Tabs keep their own form state; remount them with the freshly saved data.
      setVersion((v) => v + 1)
    }
  }, [patientId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [, patientRes, doctorRes] = await Promise.all([
        reload(),
        fetch(`/api/patients/${patientId}`),
        fetch('/api/staff/doctors'),
      ])
      if (cancelled) return
      if (patientRes.ok) setPatient((await patientRes.json()).patient ?? null)
      if (doctorRes.ok) {
        const body = await doctorRes.json()
        setDoctors(Array.isArray(body) ? body : (body.doctors ?? []))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [patientId, reload])

  if (loading) return <Loader2 className="m-8 h-6 w-6 animate-spin" />

  const ctx: WorkspaceCtx = { patientId, patient, data, billing, doctors, reload, go: setTab }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={`/patients/${patientId}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#086be6]"
        >
          <ArrowLeft className="h-4 w-4" /> Patient
        </Link>
        <Link href="/braces" className="text-sm font-semibold text-[#086be6]">
          All braces patients
        </Link>
      </div>
      <h1 className="text-2xl font-semibold">
        Braces department{patient ? ` · ${patient.firstName} ${patient.lastName}` : ''}
      </h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          {TABS.map(([value, label]) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" key={`o${version}`}>
          <OverviewTab ctx={ctx} />
        </TabsContent>
        <TabsContent value="assessment" key={`a${version}`}>
          <AssessmentTab ctx={ctx} />
        </TabsContent>
        <TabsContent value="records" key={`r${version}`}>
          <RecordsTab ctx={ctx} />
        </TabsContent>
        <TabsContent value="plan" key={`p${version}`}>
          <PlanTab ctx={ctx} />
        </TabsContent>
        <TabsContent value="visits" key={`v${version}`}>
          <VisitsTab ctx={ctx} />
        </TabsContent>
        <TabsContent value="tracking" key={`t${version}`}>
          <TrackingTab ctx={ctx} />
        </TabsContent>
        <TabsContent value="retention" key={`e${version}`}>
          <RetentionTab ctx={ctx} />
        </TabsContent>
        <TabsContent value="documents" key={`d${version}`}>
          <DocumentsTab ctx={ctx} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
