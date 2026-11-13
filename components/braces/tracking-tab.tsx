'use client'

import { useMemo, useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { labelOf } from '@/lib/braces/schema'

import { EmptyNote, Field, Pick, doctorName, showDate, type WorkspaceCtx } from './shared'
import { mediaUrl } from './records-tab'
import { PHOTO_CATEGORIES } from '@/lib/braces/schema'

/* eslint-disable @typescript-eslint/no-explicit-any */
function Compare({ ctx }: { ctx: WorkspaceCtx }) {
  const [category, setCategory] = useState('')
  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')
  const [mode, setMode] = useState<'side' | 'slider'>('side')
  const [pos, setPos] = useState(50)

  const photos = useMemo(
    () =>
      (ctx.data?.media ?? [])
        .filter((m) => m.kind === 'PHOTO' && m.document?.fileType?.startsWith('image/'))
        .filter((m) => !category || m.category === category)
        .sort((a, b) => +new Date(a.capturedAt) - +new Date(b.capturedAt)),
    [ctx.data, category]
  )
  const left = photos.find((p) => p.id === leftId) ?? photos[0]
  const right = photos.find((p) => p.id === rightId) ?? photos[photos.length - 1]
  const optionLabel = (m: any) =>
    `${showDate(m.capturedAt)} · ${labelOf(m.category)}${m.stage ? ` · ${labelOf(m.stage)}` : ''}`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Photograph comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {photos.length < 2 ? (
          <EmptyNote>
            Upload at least two photographs of the same category to compare them.
          </EmptyNote>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Category">
                <Pick
                  value={category}
                  onChange={setCategory}
                  options={PHOTO_CATEGORIES}
                  placeholder="All categories"
                />
              </Field>
              {[
                ['Before (earlier)', left?.id, setLeftId],
                ['After (later)', right?.id, setRightId],
              ].map(([label, value, setter]: any) => (
                <Field key={label} label={label}>
                  <select
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {photos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {optionLabel(m)}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
              <Field label="View">
                <Pick
                  value={mode}
                  onChange={(v) => setMode((v as any) || 'side')}
                  options={['side', 'slider']}
                />
              </Field>
            </div>
            {left && right && mode === 'side' && (
              <div className="grid gap-3 sm:grid-cols-2">
                {[left, right].map((m) => (
                  <figure key={m.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mediaUrl(ctx.patientId, m.documentId)}
                      alt={optionLabel(m)}
                      className="w-full rounded-lg border object-contain"
                    />
                    <figcaption className="mt-1 text-xs text-muted-foreground">
                      {optionLabel(m)}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
            {left && right && mode === 'slider' && (
              <div>
                <div className="relative mx-auto max-w-xl select-none overflow-hidden rounded-lg border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaUrl(ctx.patientId, right.documentId)}
                    alt="After"
                    className="block w-full"
                  />
                  <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mediaUrl(ctx.patientId, left.documentId)}
                      alt="Before"
                      className="block h-full max-w-none object-cover"
                      style={{ width: `${(100 / Math.max(pos, 1)) * 100}%` }}
                    />
                  </div>
                  <div
                    className="absolute inset-y-0 w-0.5 bg-white shadow"
                    style={{ left: `${pos}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={1}
                  max={99}
                  value={pos}
                  onChange={(e) => setPos(Number(e.target.value))}
                  className="mx-auto mt-2 block w-full max-w-xl"
                  aria-label="Before and after slider"
                />
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  Left: {optionLabel(left)} · Right: {optionLabel(right)}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

type Event = { at: string; title: string; detail: string; tab: string }

function Timeline({ ctx }: { ctx: WorkspaceCtx }) {
  const d = ctx.data
  const events: Event[] = []
  if (d) {
    events.push({ at: d.createdAt, title: 'Braces case opened', detail: '', tab: 'overview' })
    if (d.treatmentStartDate)
      events.push({
        at: d.treatmentStartDate,
        title: 'Treatment start date',
        detail: labelOf(d.planStatus),
        tab: 'plan',
      })
    d.assessments.forEach((a) =>
      events.push({
        at: a.assessedAt,
        title: 'Orthodontic assessment',
        detail: a.clinicalDiagnosis || a.chiefComplaint || '',
        tab: 'assessment',
      })
    )
    d.visits.forEach((v) =>
      events.push({
        at: v.visitDate,
        title: labelOf(v.visitType),
        detail: [doctorName(v.doctor), v.status ? labelOf(v.status) : '']
          .filter(Boolean)
          .join(' · '),
        tab: 'visits',
      })
    )
    d.media.forEach((m) =>
      events.push({
        at: m.capturedAt,
        title: m.kind === 'PHOTO' ? 'Clinical photograph' : 'X-ray record',
        detail: labelOf(m.category),
        tab: 'records',
      })
    )
    if (d.removalDate)
      events.push({ at: d.removalDate, title: 'Braces removed', detail: '', tab: 'retention' })
    d.retentionChecks.forEach((c) =>
      events.push({
        at: c.checkDate,
        title: 'Retention check',
        detail: c.relapse || c.compliance || '',
        tab: 'retention',
      })
    )
  }
  events.sort((a, b) => +new Date(b.at) - +new Date(a.at))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Case timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyNote>Nothing recorded yet.</EmptyNote>
        ) : (
          <ol className="space-y-2 border-l pl-4">
            {events.map((e, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => ctx.go(e.tab)}
                  className="w-full rounded-md p-2 text-left text-sm hover:bg-muted"
                >
                  <span className="text-xs text-muted-foreground">{showDate(e.at)}</span>
                  <div className="font-medium">{e.title}</div>
                  {e.detail && <div className="text-muted-foreground">{e.detail}</div>}
                </button>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

export function TrackingTab({ ctx }: { ctx: WorkspaceCtx }) {
  return (
    <div className="space-y-4">
      <Compare ctx={ctx} />
      <Timeline ctx={ctx} />
    </div>
  )
}
