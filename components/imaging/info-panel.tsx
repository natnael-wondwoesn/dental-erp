'use client'

import { useEffect, useState } from 'react'
import { Loader2, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { labelOf, MEDIA_STAGES, PHOTO_CATEGORIES, XRAY_CATEGORIES } from '@/lib/braces/schema'

import { imageTitle, type ImageItem } from './types'

export type HistoryEntry = { id: string; label: string; at: string; by: string | null }
type Visit = { id: string; visitDate: string; visitType: string }

export function useImageHistory(patientId: string, mediaId: string | null, version: number) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  useEffect(() => {
    let cancelled = false
    if (!mediaId) return
    fetch(`/api/patients/${patientId}/braces/media/${mediaId}/history`)
      .then((r) => (r.ok ? r.json() : { history: [] }))
      .then((b) => !cancelled && setHistory(b.history ?? []))
      .catch(() => !cancelled && setHistory([]))
    return () => {
      cancelled = true
    }
  }, [patientId, mediaId, version])
  return mediaId ? history : []
}

function Row({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex justify-between gap-3 border-b py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v || '-'}</span>
    </div>
  )
}

export function InfoPanel({
  patientId,
  item,
  visits,
  history,
  canEdit,
  onSaved,
}: {
  patientId: string
  item: ImageItem | null
  visits: Visit[]
  history: HistoryEntry[]
  canEdit: boolean
  onSaved: () => Promise<void> | void
}) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    category: '',
    stage: '',
    capturedAt: '',
    relatedVisitId: '',
    notes: '',
  })

  useEffect(() => {
    setEditing(false)
    if (item) {
      setForm({
        title: item.title ?? '',
        category: item.category,
        stage: item.stage ?? '',
        capturedAt: item.capturedAt.slice(0, 10),
        relatedVisitId: item.relatedVisitId ?? '',
        notes: item.notes ?? '',
      })
    }
  }, [item])

  if (!item) {
    return (
      <div className="rounded-xl border bg-white p-4 text-sm text-muted-foreground">
        Select an image to see its details.
      </div>
    )
  }

  const visit = visits.find((v) => v.id === item.relatedVisitId)
  const uploadedBy = [...history].reverse().find((h) => h.label === 'Image uploaded')?.by
  const categories = item.kind === 'PHOTO' ? PHOTO_CATEGORIES : XRAY_CATEGORIES
  const field = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm'

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/patients/${patientId}/braces/media/${item!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      setEditing(false)
      await onSaved()
      toast({ title: 'Image information updated' })
    } else {
      toast({ title: (await res.json()).error || 'Could not save', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Image details</h2>
          {canEdit && !editing && (
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-3 w-3" /> Edit
            </Button>
          )}
        </div>
        {editing ? (
          <div className="space-y-2">
            <Input
              aria-label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Title"
              className="h-9"
            />
            <select
              className={field}
              aria-label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {labelOf(c)}
                </option>
              ))}
            </select>
            <select
              className={field}
              aria-label="Stage"
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value })}
            >
              <option value="">No stage</option>
              {MEDIA_STAGES.map((s) => (
                <option key={s} value={s}>
                  {labelOf(s)}
                </option>
              ))}
            </select>
            <Input
              type="date"
              aria-label="Capture date"
              value={form.capturedAt}
              onChange={(e) => setForm({ ...form, capturedAt: e.target.value })}
              className="h-9"
            />
            <select
              className={field}
              aria-label="Related visit"
              value={form.relatedVisitId}
              onChange={(e) => setForm({ ...form, relatedVisitId: e.target.value })}
            >
              <option value="">No related visit</option>
              {visits.map((v) => (
                <option key={v.id} value={v.id}>
                  {new Date(v.visitDate).toLocaleDateString()} · {labelOf(v.visitType)}
                </option>
              ))}
            </select>
            <Textarea
              aria-label="Clinical notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Clinical notes"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Row k="Title" v={imageTitle(item, labelOf)} />
            <Row k="Category" v={labelOf(item.category)} />
            <Row k="Treatment stage" v={item.stage ? labelOf(item.stage) : ''} />
            <Row k="Capture date" v={new Date(item.capturedAt).toLocaleDateString()} />
            <Row k="Upload date" v={new Date(item.createdAt).toLocaleDateString()} />
            <Row k="Uploaded by" v={uploadedBy} />
            <Row
              k="Related visit"
              v={
                visit
                  ? `${new Date(visit.visitDate).toLocaleDateString()} · ${labelOf(visit.visitType)}`
                  : ''
              }
            />
            {item.interpretation && <Row k="Interpretation" v={item.interpretation} />}
            <div className="pt-2 text-sm">
              <div className="text-muted-foreground">Clinical notes</div>
              <p className="whitespace-pre-wrap">{item.notes || '-'}</p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold">Measurements</h2>
        <p className="text-sm text-muted-foreground">
          Saved distance and angle measurements will appear here once the measurement tools are
          added.
        </p>
      </div>

      <div className="rounded-xl border bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold">Image history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ol className="space-y-2 border-l pl-3 text-sm">
            {history.slice(0, 5).map((h) => (
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
      </div>
    </div>
  )
}
