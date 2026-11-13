'use client'

import { useState } from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'

import { DentalChart } from '@/components/dental-chart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  MEDIA_STAGES,
  PHOTO_CATEGORIES,
  XRAY_CATEGORIES,
  labelOf,
  localToday,
} from '@/lib/braces/schema'

import { EmptyNote, Field, Pick, showDate, type WorkspaceCtx } from './shared'

export const mediaUrl = (patientId: string, documentId: string) =>
  `/api/patients/${patientId}/documents/${documentId}?download=true`

function MediaSection({ ctx, kind }: { ctx: WorkspaceCtx; kind: 'PHOTO' | 'XRAY' }) {
  const { toast } = useToast()
  const categories = kind === 'PHOTO' ? PHOTO_CATEGORIES : XRAY_CATEGORIES
  const [category, setCategory] = useState('')
  const [stage, setStage] = useState('')
  const [capturedAt, setCapturedAt] = useState(localToday())
  const [interpretation, setInterpretation] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const items = (ctx.data?.media ?? []).filter((m) => m.kind === kind)

  async function upload() {
    if (!category || files.length === 0) {
      toast({ title: 'Choose a category and at least one file', variant: 'destructive' })
      return
    }
    setBusy(true)
    let failed = 0
    for (const file of files) {
      const body = new FormData()
      body.append('file', file)
      body.append('documentType', kind === 'PHOTO' ? 'PHOTO' : 'XRAY')
      body.append('description', `Braces ${kind === 'PHOTO' ? 'photograph' : 'x-ray'}`)
      const up = await fetch(`/api/patients/${ctx.patientId}/documents`, { method: 'POST', body })
      if (!up.ok) {
        failed += 1
        continue
      }
      const documentId = (await up.json()).document?.id
      const res = await fetch(`/api/patients/${ctx.patientId}/braces/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          kind,
          category,
          stage,
          capturedAt,
          interpretation,
          notes,
        }),
      })
      if (!res.ok) failed += 1
    }
    setBusy(false)
    setFiles([])
    setNotes('')
    setInterpretation('')
    await ctx.reload()
    toast(
      failed
        ? { title: `${failed} file(s) could not be saved`, variant: 'destructive' }
        : { title: 'Saved. Originals are kept unchanged.' }
    )
  }

  async function remove(id: string) {
    if (!confirm('Remove this record? The original file is kept in the archive.')) return
    const res = await fetch(`/api/patients/${ctx.patientId}/braces/media/${id}`, {
      method: 'DELETE',
    })
    if (res.ok) await ctx.reload()
  }

  const grouped = categories
    .map((c) => ({ c, list: items.filter((m) => m.category === c) }))
    .filter((g) => g.list.length)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{kind === 'PHOTO' ? 'Clinical photographs' : 'Radiographic records'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-4">
          <Field label="Category">
            <Pick value={category} onChange={setCategory} options={categories} />
          </Field>
          <Field label="Treatment stage">
            <Pick value={stage} onChange={setStage} options={MEDIA_STAGES} />
          </Field>
          <Field label={kind === 'PHOTO' ? 'Capture date' : 'Examination date'}>
            <Input type="date" value={capturedAt} onChange={(e) => setCapturedAt(e.target.value)} />
          </Field>
          <Field label="Files (several allowed)">
            <Input
              type="file"
              multiple
              accept={kind === 'XRAY' ? 'image/*,application/pdf' : 'image/*'}
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </Field>
          {kind === 'XRAY' && (
            <Field label="Doctor's interpretation" className="sm:col-span-2">
              <Textarea
                value={interpretation}
                onChange={(e) => setInterpretation(e.target.value)}
              />
            </Field>
          )}
          <Field
            label="Clinical notes"
            className={kind === 'XRAY' ? 'sm:col-span-2' : 'sm:col-span-3'}
          >
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button onClick={upload} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload
            </Button>
          </div>
        </div>

        {grouped.length === 0 ? (
          <EmptyNote>Nothing uploaded yet.</EmptyNote>
        ) : (
          grouped.map(({ c, list }) => (
            <div key={c}>
              <h4 className="mb-2 text-sm font-semibold">{labelOf(c)}</h4>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {list.map((m) => {
                  const isImage = m.document?.fileType?.startsWith('image/')
                  const url = mediaUrl(ctx.patientId, m.documentId)
                  return (
                    <div key={m.id} className="rounded-lg border p-2 text-xs">
                      <a href={url} target="_blank" rel="noreferrer">
                        {isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={url}
                            alt={labelOf(c)}
                            className="mb-2 h-32 w-full rounded object-cover"
                          />
                        ) : (
                          <div className="mb-2 flex h-32 items-center justify-center rounded bg-muted">
                            {m.document?.originalName ?? 'File'}
                          </div>
                        )}
                      </a>
                      <div className="font-medium">{showDate(m.capturedAt)}</div>
                      {m.stage && <div className="text-muted-foreground">{labelOf(m.stage)}</div>}
                      {m.interpretation && <div className="mt-1">{m.interpretation}</div>}
                      {m.notes && <div className="mt-1 text-muted-foreground">{m.notes}</div>}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-7 px-1"
                        onClick={() => remove(m.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export function RecordsTab({ ctx }: { ctx: WorkspaceCtx }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Dental chart</CardTitle>
          <p className="text-sm text-muted-foreground">
            General dental conditions: missing teeth, restorations, caries. Orthodontic measurements
            and tooth movement are recorded in the assessments.
          </p>
        </CardHeader>
        <CardContent>
          <DentalChart patientId={ctx.patientId} />
        </CardContent>
      </Card>
      <MediaSection ctx={ctx} kind="PHOTO" />
      <MediaSection ctx={ctx} kind="XRAY" />
    </div>
  )
}
