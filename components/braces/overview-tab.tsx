'use client'

import Link from 'next/link'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { labelOf } from '@/lib/braces/schema'

import { ageFrom, money, showDate, type WorkspaceCtx } from './shared'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value || '-'}</div>
    </div>
  )
}

export function OverviewTab({ ctx }: { ctx: WorkspaceCtx }) {
  const { data, patient, billing } = ctx
  const [starting, setStarting] = useState(false)

  async function start() {
    setStarting(true)
    await fetch(`/api/patients/${ctx.patientId}/braces`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    await ctx.reload()
    setStarting(false)
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No braces case yet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Start a braces case to record the orthodontic assessment, records, treatment plan,
            visits and retention for this patient.
          </p>
          <Button onClick={start} disabled={starting}>
            {starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Start braces case
          </Button>
        </CardContent>
      </Card>
    )
  }

  const visits = data.visits
  const last = visits.find((v) => !v.status || v.status === 'COMPLETED') ?? visits[0]
  const now = Date.now()
  const upcoming = visits
    .filter((v) => v.nextAppointment && new Date(v.nextAppointment).getTime() >= now - 86_400_000)
    .sort((a, b) => +new Date(a.nextAppointment) - +new Date(b.nextAppointment))[0]
  const latestProgress = visits.find((v) => v.progressSinceLast || v.clinicalProgress)
  const latestAssessment = data.assessments[0]
  const type = data.customBracesType || (data.bracesType ? labelOf(data.bracesType) : '')
  const age = ageFrom(patient)

  const alerts: string[] = []
  const lastNext = visits.find((v) => v.nextAppointment)?.nextAppointment
  if (lastNext && !upcoming && ['ACTIVE', 'IN_PROGRESS'].includes(data.planStatus)) {
    alerts.push(`The next appointment date (${showDate(lastNext)}) has passed with no new visit.`)
  }
  if (last && ['ACTIVE', 'IN_PROGRESS'].includes(data.planStatus)) {
    const days = Math.floor((now - new Date(last.visitDate).getTime()) / 86_400_000)
    if (days > 60) alerts.push(`No visit recorded for ${days} days.`)
  }
  if (visits.some((v) => v.status === 'MISSED')) alerts.push('This patient has a missed visit.')
  if (data.removalDate && data.retentionChecks.length === 0) {
    alerts.push('Braces were removed but no retention check has been recorded yet.')
  }

  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="space-y-1 p-4 text-sm text-amber-900">
            {alerts.map((a) => (
              <div key={a} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {a}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>
            {patient ? `${patient.firstName} ${patient.lastName}` : 'Patient'}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {[patient?.patientId, age != null ? `${age} yrs` : '', patient?.phone]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </CardTitle>
          <Badge variant="outline">{labelOf(data.planStatus)}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Braces type" value={type} />
          <Stat label="Treatment start" value={showDate(data.treatmentStartDate)} />
          <Stat label="Estimated completion" value={showDate(data.estimatedCompletionDate)} />
          <Stat label="Last visit" value={last ? showDate(last.visitDate) : ''} />
          <Stat
            label="Next appointment"
            value={upcoming ? showDate(upcoming.nextAppointment) : ''}
          />
          <Stat
            label="Latest assessment"
            value={latestAssessment ? showDate(latestAssessment.assessedAt) : ''}
          />
          <Stat label="Visits recorded" value={String(visits.length)} />
          <Stat label="Braces removed" value={showDate(data.removalDate)} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {billing ? (
              <>
                <div className="flex justify-between">
                  <span>Total billed</span>
                  <span>{money(billing.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid</span>
                  <span>{money(billing.paid)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Outstanding balance</span>
                  <span>{money(billing.balance)}</span>
                </div>
                {data.estimatedCost != null && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Estimated treatment cost</span>
                    <span>{money(Number(data.estimatedCost))}</span>
                  </div>
                )}
              </>
            ) : null}
            <Link href="/billing" className="text-xs font-semibold text-[#086be6]">
              Open billing
            </Link>
            <p className="text-xs text-muted-foreground">
              Payments stay in the clinic billing module and are not duplicated here.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest clinical progress</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {latestProgress ? (
              <>
                <div className="mb-1 text-xs text-muted-foreground">
                  {showDate(latestProgress.visitDate)}
                </div>
                <p className="whitespace-pre-wrap">
                  {latestProgress.progressSinceLast || latestProgress.clinicalProgress}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">No progress recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
