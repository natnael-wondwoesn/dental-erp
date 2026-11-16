'use client'

import { useMemo, useState } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { labelOf } from '@/lib/braces/schema'

import type { HistoryEntry } from './info-panel'
import { imageTitle, imageUrl, type ImageItem } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
const caption = (m: ImageItem) =>
  `${imageTitle(m, labelOf)} · ${new Date(m.capturedAt).toLocaleDateString()}${m.stage ? ` · ${labelOf(m.stage)}` : ''}`

function Compare({
  patientId,
  items,
  selected,
}: {
  patientId: string
  items: ImageItem[]
  selected: ImageItem | null
}) {
  const [mode, setMode] = useState<'side' | 'before-after'>('side')
  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')
  const [pos, setPos] = useState(50)
  const sorted = useMemo(
    () => [...items].sort((a, b) => +new Date(a.capturedAt) - +new Date(b.capturedAt)),
    [items]
  )
  if (sorted.length < 2) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Upload at least two images to compare them.
      </p>
    )
  }
  const left =
    sorted.find((m) => m.id === leftId) ?? sorted.find((m) => m.id !== selected?.id) ?? sorted[0]
  const right = sorted.find((m) => m.id === rightId) ?? selected ?? sorted[sorted.length - 1]
  const sel = 'h-9 rounded-md border border-input bg-background px-2 text-sm'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={sel}
          value={left.id}
          onChange={(e) => setLeftId(e.target.value)}
          aria-label="First image"
        >
          {sorted.map((m) => (
            <option key={m.id} value={m.id}>
              {caption(m)}
            </option>
          ))}
        </select>
        <select
          className={sel}
          value={right.id}
          onChange={(e) => setRightId(e.target.value)}
          aria-label="Second image"
        >
          {sorted.map((m) => (
            <option key={m.id} value={m.id}>
              {caption(m)}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-1">
          {(
            [
              ['side', 'Side-by-side'],
              ['before-after', 'Before & after'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`rounded-md border px-3 py-1 text-sm ${mode === key ? 'bg-primary text-primary-foreground' : ''}`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            disabled
            title="Available in a later release"
            className="rounded-md border px-3 py-1 text-sm opacity-50"
          >
            Overlay
          </button>
        </div>
      </div>
      {mode === 'side' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[left, right].map((m) => (
            <figure key={m.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(patientId, m.documentId)}
                alt={caption(m)}
                className="h-64 w-full rounded-lg border bg-black object-contain"
              />
              <figcaption className="mt-1 text-xs text-muted-foreground">{caption(m)}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div>
          <div className="relative mx-auto h-64 max-w-xl select-none overflow-hidden rounded-lg border bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl(patientId, right.documentId)}
              alt="After"
              className="absolute inset-0 h-full w-full object-contain"
            />
            <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pos}%` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(patientId, left.documentId)}
                alt="Before"
                className="h-full max-w-none object-contain"
                style={{ width: `${(100 / Math.max(pos, 1)) * 100}%` }}
              />
            </div>
            <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }} />
          </div>
          <input
            type="range"
            min={1}
            max={99}
            value={pos}
            onChange={(e) => setPos(+e.target.value)}
            className="mx-auto mt-2 block w-full max-w-xl"
            aria-label="Before and after slider"
          />
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Left: {caption(left)} · Right: {caption(right)}
          </p>
        </div>
      )}
    </div>
  )
}

export function BottomTabs({
  patientId,
  items,
  selected,
  history,
  braces,
}: {
  patientId: string
  items: ImageItem[]
  selected: ImageItem | null
  history: HistoryEntry[]
  braces: any
}) {
  const assessments: any[] = braces?.assessments ?? []
  const visits: any[] = braces?.visits ?? []
  const day = (v: string) => new Date(v).toLocaleDateString()

  return (
    <div className="rounded-xl border bg-white p-3">
      <Tabs defaultValue="compare">
        <TabsList>
          <TabsTrigger value="compare">Compare images</TabsTrigger>
          <TabsTrigger value="history">Image history</TabsTrigger>
          <TabsTrigger value="related">Related records</TabsTrigger>
        </TabsList>
        <TabsContent value="compare">
          <Compare patientId={patientId} items={items} selected={selected} />
        </TabsContent>
        <TabsContent value="history">
          {!selected ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Select an image to see its history.
            </p>
          ) : history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No activity recorded for this image yet.
            </p>
          ) : (
            <ol className="space-y-2 border-l pl-4 text-sm">
              {history.map((h) => (
                <li key={h.id}>
                  <div className="font-medium">{h.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(h.at).toLocaleString()}
                    {h.by ? ` · ${h.by}` : ''}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
        <TabsContent value="related">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-semibold">Assessments</h3>
              {assessments.length === 0 ? (
                <p className="text-sm text-muted-foreground">None recorded.</p>
              ) : (
                assessments.slice(0, 5).map((a) => (
                  <div key={a.id} className="border-b py-1 text-sm">
                    {day(a.assessedAt)} · {a.clinicalDiagnosis || a.chiefComplaint || 'Assessment'}
                  </div>
                ))
              )}
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold">Visits</h3>
              {visits.length === 0 ? (
                <p className="text-sm text-muted-foreground">None recorded.</p>
              ) : (
                visits.slice(0, 5).map((v) => (
                  <div
                    key={v.id}
                    className={`border-b py-1 text-sm ${selected?.relatedVisitId === v.id ? 'font-semibold' : ''}`}
                  >
                    {day(v.visitDate)} · {labelOf(v.visitType)}
                    {selected?.relatedVisitId === v.id ? ' (linked to this image)' : ''}
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
