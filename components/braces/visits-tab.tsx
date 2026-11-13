'use client'

import { useState } from 'react'
import { Loader2, Pencil, Plus, Printer, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  VISIT_STATUSES,
  VISIT_TYPES,
  WIRE_ACTIONS,
  WIRE_ARCHES,
  WIRE_TYPES,
  labelOf,
  localToday,
} from '@/lib/braces/schema'

import {
  EmptyNote,
  Field,
  Pick,
  day,
  doctorName,
  esc,
  printReport,
  showDate,
  type WorkspaceCtx,
} from './shared'

/* eslint-disable @typescript-eslint/no-explicit-any */
const TEXTS: [string, string][] = [
  ['clinicalFindings', 'Clinical findings'],
  ['progressSinceLast', 'Progress since previous visit'],
  ['objectivesAchieved', 'Treatment objectives achieved'],
  ['remainingObjectives', 'Remaining treatment objectives'],
  ['complications', 'Complications or problems'],
  ['modifications', 'Treatment modifications'],
  ['recommendations', "Doctor's recommendations"],
  ['patientConcerns', 'Patient concerns'],
  ['applianceChanges', 'Appliance changes (brackets, elastics, etc.)'],
]

const blank = () => ({
  visitDate: localToday(),
  visitType: 'ADJUSTMENT',
  status: 'COMPLETED',
  doctorId: '',
  currentStage: '',
  nextAppointment: '',
  proceduresPerformed: [] as string[],
  wires: [] as any[],
  wireAdjustments: '',
  clinicalProgress: '',
  ...Object.fromEntries(TEXTS.map(([k]) => [k, ''])),
})

export function visitReport(ctx: WorkspaceCtx, v: any) {
  const p = ctx.patient
  const rows = [
    ['Visit date', showDate(v.visitDate)],
    ['Visit type', labelOf(v.visitType)],
    ['Status', v.status ? labelOf(v.status) : ''],
    ['Orthodontist', doctorName(v.doctor)],
    ['Treatment stage', v.currentStage],
    ['Procedures performed', (v.proceduresPerformed ?? []).join(', ')],
    ...(v.wires ?? []).map((w: any) => [
      'Wire',
      `${labelOf(w.arch)} - ${w.wireType ? labelOf(w.wireType) : ''} ${w.wireSize} - ${labelOf(w.action)}${w.notes ? ` (${w.notes})` : ''}`,
    ]),
    ...TEXTS.map(([k, l]) => [l, v[k]]),
    ['Next appointment', v.nextAppointment ? showDate(v.nextAppointment) : ''],
  ].filter(([, value]) => value)
  printReport(
    `${labelOf(v.visitType)} report`,
    `<h1>${esc(labelOf(v.visitType))} report</h1><p class="muted">${esc(p ? `${p.firstName} ${p.lastName}` : '')} ${esc(p?.patientId ?? '')}</p>
     <table>${rows.map(([k, val]) => `<tr><th>${esc(k)}</th><td>${esc(val)}</td></tr>`).join('')}</table>
     <div class="sig"><div>Orthodontist signature</div><div>Date</div></div>`
  )
}

export function VisitsTab({ ctx }: { ctx: WorkspaceCtx }) {
  const { toast } = useToast()
  const [form, setForm] = useState<any>(blank)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const set = (key: string, value: unknown) => setForm((f: any) => ({ ...f, [key]: value }))
  const data = ctx.data
  const stages: string[] = (data?.stages ?? []).map((s: any) => s.name).filter(Boolean)
  const planned: string[] = (data?.procedureList ?? []).map((p: any) => p.name).filter(Boolean)

  if (!data)
    return (
      <Card>
        <CardContent className="p-6 text-sm">
          Start the braces case on the Overview tab first.
        </CardContent>
      </Card>
    )

  async function save() {
    setSaving(true)
    const url = editing
      ? `/api/patients/${ctx.patientId}/braces/visits/${editing}`
      : `/api/patients/${ctx.patientId}/braces/visits`
    const res = await fetch(url, {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      setForm(blank())
      setEditing(null)
      await ctx.reload()
      toast({ title: editing ? 'Visit updated' : 'Visit recorded' })
    } else {
      toast({ title: (await res.json()).error || 'Could not save visit', variant: 'destructive' })
    }
  }

  function edit(v: any) {
    setEditing(v.id)
    setForm({
      ...blank(),
      ...Object.fromEntries(
        Object.entries(v).map(([k, val]) => [k, val ?? (blank() as any)[k] ?? ''])
      ),
      visitDate: day(v.visitDate),
      nextAppointment: day(v.nextAppointment),
      doctorId: v.doctorId ?? '',
      proceduresPerformed: v.proceduresPerformed ?? [],
      wires: v.wires ?? [],
      status: v.status ?? 'COMPLETED',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function remove(id: string) {
    if (!confirm('Delete this visit record? This is logged in the audit history.')) return
    const res = await fetch(`/api/patients/${ctx.patientId}/braces/visits/${id}`, {
      method: 'DELETE',
    })
    if (res.ok) await ctx.reload()
  }

  const wire = (i: number, patch: object) =>
    set(
      'wires',
      form.wires.map((w: any, n: number) => (n === i ? { ...w, ...patch } : w))
    )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{editing ? 'Edit visit' : 'Record a visit'}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Every visit is saved as its own record and never overwrites a previous one. Fill only
            what applies to this visit.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Visit date">
              <Input
                type="date"
                value={form.visitDate}
                onChange={(e) => set('visitDate', e.target.value)}
              />
            </Field>
            <Field label="Visit type">
              <Pick
                value={form.visitType}
                onChange={(v) => set('visitType', v || 'ADJUSTMENT')}
                options={VISIT_TYPES.filter((t) => t !== 'REVIEW' || form.visitType === 'REVIEW')}
              />
            </Field>
            <Field label="Visit status">
              <Pick
                value={form.status}
                onChange={(v) => set('status', v)}
                options={VISIT_STATUSES}
              />
            </Field>
            <Field label="Responsible orthodontist">
              <select
                value={form.doctorId}
                onChange={(e) => set('doctorId', e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select…</option>
                {ctx.doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {doctorName(d)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Current treatment stage">
              {stages.length ? (
                <select
                  value={form.currentStage}
                  onChange={(e) => set('currentStage', e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select…</option>
                  {stages.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <Input
                  value={form.currentStage}
                  onChange={(e) => set('currentStage', e.target.value)}
                />
              )}
            </Field>
            <Field label="Next appointment">
              <Input
                type="date"
                value={form.nextAppointment}
                onChange={(e) => set('nextAppointment', e.target.value)}
              />
            </Field>
          </div>

          {planned.length > 0 && (
            <Field label="Procedures performed (from the plan)">
              <div className="flex flex-wrap gap-2">
                {planned.map((name) => {
                  const on = form.proceduresPerformed.includes(name)
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() =>
                        set(
                          'proceduresPerformed',
                          on
                            ? form.proceduresPerformed.filter((n: string) => n !== name)
                            : [...form.proceduresPerformed, name]
                        )
                      }
                      className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'}`}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {TEXTS.map(([key, label]) => (
              <Field key={key} label={label}>
                <Textarea value={form[key]} onChange={(e) => set(key, e.target.value)} />
              </Field>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Wire details (optional)</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  set('wires', [
                    ...form.wires,
                    { arch: 'UPPER', wireType: '', wireSize: '', action: 'ADJUSTED', notes: '' },
                  ])
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Add wire
              </Button>
            </div>
            {form.wires.map((w: any, i: number) => (
              <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-6">
                <Pick
                  value={w.arch}
                  onChange={(v) => wire(i, { arch: v || 'UPPER' })}
                  options={WIRE_ARCHES}
                />
                <Pick
                  value={w.wireType ?? ''}
                  onChange={(v) => wire(i, { wireType: v })}
                  options={WIRE_TYPES}
                  placeholder="Wire type"
                />
                <Input
                  placeholder="Size e.g. 0.016 x 0.022"
                  value={w.wireSize}
                  onChange={(e) => wire(i, { wireSize: e.target.value })}
                />
                <Pick
                  value={w.action}
                  onChange={(v) => wire(i, { action: v || 'ADJUSTED' })}
                  options={WIRE_ACTIONS}
                />
                <Input
                  placeholder="Notes"
                  value={w.notes}
                  onChange={(e) => wire(i, { notes: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    set(
                      'wires',
                      form.wires.filter((_: any, n: number) => n !== i)
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Field label="Other wire adjustments (free text)">
              <Textarea
                value={form.wireAdjustments}
                onChange={(e) => set('wireAdjustments', e.target.value)}
              />
            </Field>
          </div>

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{' '}
              {editing ? 'Update visit' : 'Save visit'}
            </Button>
            {editing && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(null)
                  setForm(blank())
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visit history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.visits.length === 0 ? (
            <EmptyNote>No visits recorded yet.</EmptyNote>
          ) : (
            data.visits.map((v: any) => {
              const isOpen = open === v.id
              return (
                <div key={v.id} className="rounded-lg border">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm"
                    onClick={() => setOpen(isOpen ? null : v.id)}
                  >
                    <span className="font-medium">
                      {showDate(v.visitDate)} · {labelOf(v.visitType)}
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {doctorName(v.doctor)}
                      {v.status && <Badge variant="outline">{labelOf(v.status)}</Badge>}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="space-y-2 border-t p-3 text-sm">
                      {v.currentStage && (
                        <div>
                          <b>Stage:</b> {v.currentStage}
                        </div>
                      )}
                      {(v.proceduresPerformed ?? []).length > 0 && (
                        <div>
                          <b>Procedures:</b> {v.proceduresPerformed.join(', ')}
                        </div>
                      )}
                      {(v.wires ?? []).map((w: any, i: number) => (
                        <div key={i}>
                          <b>Wire:</b> {labelOf(w.arch)} · {w.wireType ? labelOf(w.wireType) : ''}{' '}
                          {w.wireSize} · {labelOf(w.action)} {w.notes}
                        </div>
                      ))}
                      {v.wireAdjustments && (
                        <div>
                          <b>Wire adjustments:</b> {v.wireAdjustments}
                        </div>
                      )}
                      {[...TEXTS, ['clinicalProgress', 'Clinical progress']].map(([k, l]) =>
                        v[k] ? (
                          <div key={k}>
                            <b>{l}:</b> <span className="whitespace-pre-wrap">{v[k]}</span>
                          </div>
                        ) : null
                      )}
                      {v.nextAppointment && (
                        <div>
                          <b>Next appointment:</b> {showDate(v.nextAppointment)}
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => edit(v)}>
                          <Pencil className="mr-1 h-3 w-3" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => visitReport(ctx, v)}>
                          <Printer className="mr-1 h-3 w-3" /> Print report
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(v.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
