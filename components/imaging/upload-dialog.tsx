'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Upload, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  labelOf,
  localToday,
  MEDIA_STAGES,
  PHOTO_CATEGORIES,
  XRAY_CATEGORIES,
} from '@/lib/braces/schema'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024

type Row = {
  key: string
  file: File
  preview: string
  title: string
  category: string
  stage: string
  capturedAt: string
  relatedVisitId: string
  notes: string
  status: 'ready' | 'uploading' | 'saved' | 'error'
  message: string
}

export function validateFile(file: Pick<File, 'type' | 'size' | 'name'>): string | null {
  if (!ACCEPTED.includes(file.type)) return 'Only JPG, PNG or WebP images are supported.'
  if (file.size > MAX_BYTES) return 'The file is larger than 10 MB.'
  return null
}

const field = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm'

export function UploadDialog({
  open,
  onOpenChange,
  patientId,
  visits,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  visits: { id: string; visitDate: string; visitType: string }[]
  onDone: () => Promise<void> | void
}) {
  const { toast } = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [rejected, setRejected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const rowsRef = useRef<Row[]>([])
  rowsRef.current = rows

  // Release the preview URLs when the dialog is closed.
  useEffect(() => {
    if (!open) {
      rowsRef.current.forEach((r) => URL.revokeObjectURL(r.preview))
      setRows([])
      setRejected([])
    }
  }, [open])

  const add = useCallback((files: File[]) => {
    const bad: string[] = []
    const next: Row[] = []
    for (const file of files) {
      const problem = validateFile(file)
      if (problem) {
        bad.push(`${file.name}: ${problem}`)
        continue
      }
      next.push({
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
        title: file.name.replace(/\.[^.]+$/, ''),
        category: '',
        stage: '',
        capturedAt: localToday(),
        relatedVisitId: '',
        notes: '',
        status: 'ready',
        message: '',
      })
    }
    setRejected(bad)
    setRows((current) => [...current, ...next])
  }, [])

  const patch = (key: string, p: Partial<Row>) =>
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...p } : r)))
  const applyAll = (p: Partial<Row>) =>
    setRows((current) => current.map((r) => (r.status === 'saved' ? r : { ...r, ...p })))

  async function save() {
    const pending = rows.filter((r) => r.status !== 'saved')
    if (pending.some((r) => !r.category)) {
      toast({ title: 'Choose a category for every image', variant: 'destructive' })
      return
    }
    setBusy(true)
    for (const row of pending) {
      patch(row.key, { status: 'uploading', message: '' })
      try {
        const body = new FormData()
        body.append('file', row.file)
        body.append(
          'documentType',
          XRAY_CATEGORIES.includes(row.category as never) ? 'XRAY' : 'PHOTO'
        )
        body.append('description', 'Braces imaging')
        const up = await fetch(`/api/patients/${patientId}/documents`, { method: 'POST', body })
        if (!up.ok) throw new Error((await up.json()).error || 'Upload failed')
        const documentId = (await up.json()).document?.id
        const res = await fetch(`/api/patients/${patientId}/braces/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId,
            kind: XRAY_CATEGORIES.includes(row.category as never) ? 'XRAY' : 'PHOTO',
            category: row.category,
            title: row.title,
            stage: row.stage,
            capturedAt: row.capturedAt,
            relatedVisitId: row.relatedVisitId,
            notes: row.notes,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Could not save')
        patch(row.key, { status: 'saved', message: '' })
      } catch (cause) {
        patch(row.key, {
          status: 'error',
          message: cause instanceof Error ? cause.message : 'Failed',
        })
      }
    }
    setBusy(false)
    await onDone()
    const failed = rowsRef.current.filter((r) => r.status === 'error').length
    if (failed) toast({ title: `${failed} image(s) could not be saved`, variant: 'destructive' })
    else {
      toast({ title: 'Images saved. Originals are kept unchanged.' })
      onOpenChange(false)
    }
  }

  const done = rows.filter((r) => r.status === 'saved').length

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload images</DialogTitle>
          <DialogDescription>
            JPG, PNG or WebP up to 10 MB each. Review the details of each image before saving.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            add(Array.from(e.dataTransfer.files))
          }}
          className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center text-sm ${drag ? 'border-[#086be6] bg-blue-50' : 'border-slate-300'}`}
        >
          <Upload className="h-6 w-6 text-slate-500" />
          <p>Drag and drop images here</p>
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
            Browse files
          </Button>
          <input
            ref={input}
            type="file"
            multiple
            accept={ACCEPTED.join(',')}
            className="hidden"
            data-testid="imaging-file-input"
            onChange={(e) => {
              add(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />
        </div>

        {rejected.length > 0 && (
          <ul className="space-y-1 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {rejected.map((r) => (
              <li key={r} className="flex gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {r}
              </li>
            ))}
          </ul>
        )}

        {rows.length > 1 && (
          <div className="grid gap-2 rounded-lg bg-muted p-3 sm:grid-cols-3">
            <select
              className={field}
              aria-label="Stage for all"
              defaultValue=""
              onChange={(e) => applyAll({ stage: e.target.value })}
            >
              <option value="">Set stage for all…</option>
              {MEDIA_STAGES.map((s) => (
                <option key={s} value={s}>
                  {labelOf(s)}
                </option>
              ))}
            </select>
            <Input
              type="date"
              aria-label="Date for all"
              onChange={(e) => e.target.value && applyAll({ capturedAt: e.target.value })}
              className="h-9"
            />
            <select
              className={field}
              aria-label="Visit for all"
              defaultValue=""
              onChange={(e) => applyAll({ relatedVisitId: e.target.value })}
            >
              <option value="">Set visit for all…</option>
              {visits.map((v) => (
                <option key={v.id} value={v.id}>
                  {new Date(v.visitDate).toLocaleDateString()} · {labelOf(v.visitType)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.key} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[96px_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.preview} alt="" className="h-24 w-24 rounded object-cover" />
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  aria-label="Image title"
                  value={r.title}
                  onChange={(e) => patch(r.key, { title: e.target.value })}
                  placeholder="Image title"
                  className="h-9"
                  disabled={r.status === 'saved'}
                />
                <select
                  className={field}
                  aria-label="Image category"
                  value={r.category}
                  onChange={(e) => patch(r.key, { category: e.target.value })}
                  disabled={r.status === 'saved'}
                >
                  <option value="">Category…</option>
                  <optgroup label="Clinical photos">
                    {PHOTO_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {labelOf(c)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Radiographs">
                    {XRAY_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {labelOf(c)}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <select
                  className={field}
                  aria-label="Treatment stage"
                  value={r.stage}
                  onChange={(e) => patch(r.key, { stage: e.target.value })}
                  disabled={r.status === 'saved'}
                >
                  <option value="">Treatment stage…</option>
                  {MEDIA_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {labelOf(s)}
                    </option>
                  ))}
                </select>
                <Input
                  type="date"
                  aria-label="Capture date"
                  value={r.capturedAt}
                  onChange={(e) => patch(r.key, { capturedAt: e.target.value })}
                  className="h-9"
                  disabled={r.status === 'saved'}
                />
                <select
                  className={`${field} sm:col-span-2`}
                  aria-label="Related visit"
                  value={r.relatedVisitId}
                  onChange={(e) => patch(r.key, { relatedVisitId: e.target.value })}
                  disabled={r.status === 'saved'}
                >
                  <option value="">Related visit (optional)…</option>
                  {visits.map((v) => (
                    <option key={v.id} value={v.id}>
                      {new Date(v.visitDate).toLocaleDateString()} · {labelOf(v.visitType)}
                    </option>
                  ))}
                </select>
                <Textarea
                  aria-label="Clinical notes"
                  className="sm:col-span-2"
                  rows={2}
                  placeholder="Clinical notes"
                  value={r.notes}
                  onChange={(e) => patch(r.key, { notes: e.target.value })}
                  disabled={r.status === 'saved'}
                />
                <div className="flex items-center justify-between text-xs sm:col-span-2">
                  <span className="truncate text-muted-foreground">{r.file.name}</span>
                  {r.status === 'uploading' && (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                    </span>
                  )}
                  {r.status === 'saved' && (
                    <span className="flex items-center gap-1 text-green-700">
                      <CheckCircle2 className="h-3 w-3" /> Saved
                    </span>
                  )}
                  {r.status === 'error' && <span className="text-red-700">{r.message}</span>}
                  {r.status === 'ready' && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-red-700"
                      aria-label="Remove image"
                      onClick={() => {
                        URL.revokeObjectURL(r.preview)
                        setRows((c) => c.filter((x) => x.key !== r.key))
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {busy && (
          <div
            className="h-2 overflow-hidden rounded bg-muted"
            role="progressbar"
            aria-valuenow={done}
            aria-valuemax={rows.length}
          >
            <div
              className="h-full bg-[#086be6] transition-all"
              style={{ width: `${rows.length ? (done / rows.length) * 100 : 0}%` }}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={busy || rows.length === 0 || rows.every((r) => r.status === 'saved')}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save{' '}
            {rows.length ? `${rows.length - done} image(s)` : 'images'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
