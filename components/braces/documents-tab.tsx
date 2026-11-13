'use client'

import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { labelOf } from '@/lib/braces/schema'

import { ageFrom, doctorName, esc, printReport, showDate, type WorkspaceCtx } from './shared'
import { visitReport } from './visits-tab'

/* eslint-disable @typescript-eslint/no-explicit-any */
const table = (rows: (string | undefined | null)[][]) =>
  `<table>${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
    .join('')}</table>`

export function DocumentsTab({ ctx }: { ctx: WorkspaceCtx }) {
  const d = ctx.data
  const p = ctx.patient
  if (!d)
    return (
      <Card>
        <CardContent className="p-6 text-sm">
          Start the braces case on the Overview tab first.
        </CardContent>
      </Card>
    )
  const who = `<p class="muted">${esc(p ? `${p.firstName} ${p.lastName}` : '')} ${esc(p?.patientId ?? '')}${ageFrom(p) != null ? ` · ${ageFrom(p)} years` : ''}</p>`
  const sign = '<div class="sig"><div>Orthodontist signature</div><div>Date</div></div>'
  const type = d.customBracesType || (d.bracesType ? labelOf(d.bracesType) : '')

  const reports: { title: string; hint: string; run: () => void }[] = [
    {
      title: 'Orthodontic assessment form',
      hint: 'Latest assessment with measurements',
      run: () => {
        const a = d.assessments[0]
        if (!a) return alert('No assessment recorded yet.')
        printReport(
          'Orthodontic assessment',
          `<h1>Orthodontic assessment</h1>${who}
          ${table([
            ['Date', showDate(a.assessedAt)],
            ['Chief complaint', a.chiefComplaint],
            ['Diagnosis', a.clinicalDiagnosis],
            ['Dental history', a.dentalHistory],
            ['Medical history', a.medicalHistory],
            ['Facial profile', a.facialProfile && labelOf(a.facialProfile)],
            ['Skeletal class', a.skeletalClass && labelOf(a.skeletalClass)],
            ['Molar R / L', [a.molarRight, a.molarLeft].filter(Boolean).map(labelOf).join(' / ')],
            [
              'Canine R / L',
              [a.canineRight, a.canineLeft].filter(Boolean).map(labelOf).join(' / '),
            ],
            ['Findings', (a.findings ?? []).map(labelOf).join(', ')],
            ['Crossbite', (a.crossbite ?? []).map(labelOf).join(', ')],
            ['Oral habits', (a.oralHabits ?? []).map(labelOf).join(', ')],
            ['Overjet (mm)', a.overjetMm],
            ['Overbite (mm)', a.overbiteMm],
            ['Upper midline (mm)', a.midlineUpperMm],
            ['Lower midline (mm)', a.midlineLowerMm],
            ['Upper crowding (mm)', a.crowdingUpperMm],
            ['Lower crowding (mm)', a.crowdingLowerMm],
            ['Upper spacing (mm)', a.spacingUpperMm],
            ['Lower spacing (mm)', a.spacingLowerMm],
            ['Notes', a.notes],
          ])}${sign}`
        )
      },
    },
    {
      title: 'Treatment plan printout',
      hint: 'Braces type, procedures, stages, estimates',
      run: () =>
        printReport(
          'Treatment plan',
          `<h1>Orthodontic treatment plan</h1>${who}
          ${table([
            ['Braces type', type],
            ['Plan status', labelOf(d.planStatus)],
            ['Treatment start', d.treatmentStartDate && showDate(d.treatmentStartDate)],
            [
              'Estimated completion',
              d.estimatedCompletionDate && showDate(d.estimatedCompletionDate),
            ],
            ['Estimated duration (months)', d.estimatedMonths],
            ['Estimated cost', d.estimatedCost],
            ['Objectives', d.objectives],
            ['Notes', d.planNotes],
          ])}
          <h2>Procedures</h2>${(d.procedureList ?? []).length ? `<table><tr><th>Procedure</th><th>Status</th></tr>${d.procedureList.map((x: any) => `<tr><td>${esc(x.name)}${x.description ? ` - ${esc(x.description)}` : ''}</td><td>${esc(labelOf(x.status))}</td></tr>`).join('')}</table>` : '<p class="muted">None recorded</p>'}
          <h2>Stages</h2>${(d.stages ?? []).length ? `<table><tr><th>Stage</th><th>Status</th></tr>${d.stages.map((x: any) => `<tr><td>${esc(x.name)}${x.description ? ` - ${esc(x.description)}` : ''}</td><td>${esc(labelOf(x.status))}</td></tr>`).join('')}</table>` : '<p class="muted">None recorded</p>'}
          <p>I have understood the plan above and agree to proceed.</p><div class="sig"><div>Patient / guardian signature</div><div>Orthodontist signature</div><div>Date</div></div>`
        ),
    },
    {
      title: 'Patient treatment progress report',
      hint: 'Summary of every recorded visit',
      run: () =>
        printReport(
          'Progress report',
          `<h1>Treatment progress report</h1>${who}
          ${table([
            ['Braces type', type],
            ['Plan status', labelOf(d.planStatus)],
            ['Visits recorded', String(d.visits.length)],
          ])}
          <h2>Visits</h2><table><tr><th>Date / type</th><th>Progress</th></tr>${[...d.visits]
            .reverse()
            .map(
              (v: any) =>
                `<tr><td>${esc(showDate(v.visitDate))}<br>${esc(labelOf(v.visitType))}<br><span class="muted">${esc(doctorName(v.doctor))}</span></td><td>${esc(v.progressSinceLast || v.clinicalProgress || '')}${v.recommendations ? `<br><i>${esc(v.recommendations)}</i>` : ''}</td></tr>`
            )
            .join('')}</table>${sign}`
        ),
    },
    {
      title: 'Retainer instructions',
      hint: 'Retainer details and wear schedule',
      run: () =>
        printReport(
          'Retainer instructions',
          `<h1>Retainer instructions</h1>${who}
          ${table([
            ['Braces removed', d.removalDate && showDate(d.removalDate)],
            ['Retainer type', d.retainerType && labelOf(d.retainerType)],
            ['Upper retainer', d.upperRetainer],
            ['Lower retainer', d.lowerRetainer],
            ['Delivered', d.retainerDeliveryDate && showDate(d.retainerDeliveryDate)],
            ['Wear', d.retainerWear && labelOf(d.retainerWear)],
            ['Instructions', d.retainerInstructions],
          ])}${sign}`
        ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents and forms</CardTitle>
        <p className="text-sm text-muted-foreground">
          Printable documents built from this patient&apos;s records. Print a single visit
          (installation, adjustment or removal report) from the Visits tab.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {reports.map((r) => (
          <div key={r.title} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">{r.title}</div>
              <div className="text-xs text-muted-foreground">{r.hint}</div>
            </div>
            <Button size="sm" variant="outline" onClick={r.run}>
              <Printer className="mr-1 h-4 w-4" /> Print
            </Button>
          </div>
        ))}
        {d.visits[0] && (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Latest visit report</div>
              <div className="text-xs text-muted-foreground">
                {showDate(d.visits[0].visitDate)} · {labelOf(d.visits[0].visitType)}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => visitReport(ctx, d.visits[0])}>
              <Printer className="mr-1 h-4 w-4" /> Print
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
