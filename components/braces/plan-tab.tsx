'use client'

import { useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  BRACES_TYPES,
  PLAN_STATUSES,
  PROCEDURE_STATUSES,
  STAGE_STATUSES,
  labelOf,
} from '@/lib/braces/schema'

import { Field, Pick, casePayload, day, type BracesData, type WorkspaceCtx } from './shared'

/* eslint-disable @typescript-eslint/no-explicit-any */
const NEW_TYPES = BRACES_TYPES.filter((t) => t !== 'METAL')

// Records saved before the structured plan only have plain-text procedures.
function initialProcedures(data: any) {
  if (data.procedureList?.length) return data.procedureList
  return (data.plannedProcedures ?? []).map((name: string) => ({
    name,
    description: '',
    plannedDate: '',
    status: 'PENDING',
    notes: '',
  }))
}

export function PlanTab({ ctx }: { ctx: WorkspaceCtx }) {
  const data = ctx.data
  const { toast } = useToast()
  const [form, setForm] = useState<any>(() => ({
    bracesType: data?.bracesType ?? '',
    customBracesType: data?.customBracesType ?? '',
    planStatus: data?.planStatus ?? 'DRAFT',
    treatmentStartDate: day(data?.treatmentStartDate),
    estimatedCompletionDate: day(data?.estimatedCompletionDate),
    estimatedMonths: data?.estimatedMonths ?? '',
    estimatedCost: data?.estimatedCost ?? '',
    objectives: data?.objectives ?? '',
    planNotes: data?.planNotes ?? '',
    procedureList: data ? initialProcedures(data) : [],
    stages: (data?.stages ?? []).map((s: any) => ({
      name: s.name ?? '',
      description: s.description ?? s.procedure ?? '',
      expectedStart: day(s.expectedStart),
      expectedCompletion: day(s.expectedCompletion ?? s.expectedDate),
      status: s.status ?? 'PLANNED',
      notes: s.notes ?? '',
    })),
  }))
  const [saving, setSaving] = useState(false)
  const set = (key: string, value: unknown) => setForm((f: any) => ({ ...f, [key]: value }))

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
    // The plan form only owns the plan; everything else on the case is sent back unchanged.
    const body = casePayload(data as BracesData, form)
    const res = await fetch(`/api/patients/${ctx.patientId}/braces`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      await ctx.reload()
      toast({ title: 'Treatment plan saved' })
    } else {
      toast({ title: (await res.json()).error || 'Save failed', variant: 'destructive' })
    }
  }

  const updateRow = (key: 'procedureList' | 'stages', index: number, patch: object) =>
    set(
      key,
      form[key].map((row: any, i: number) => (i === index ? { ...row, ...patch } : row))
    )
  const removeRow = (key: 'procedureList' | 'stages', index: number) =>
    set(
      key,
      form[key].filter((_: any, i: number) => i !== index)
    )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Treatment plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type of braces">
              <Pick
                value={form.bracesType}
                onChange={(v) => set('bracesType', v)}
                options={form.bracesType === 'METAL' ? [...NEW_TYPES, 'METAL'] : NEW_TYPES}
              />
            </Field>
            <Field label="Custom type" hint="Use when the type is not in the list">
              <Input
                value={form.customBracesType}
                onChange={(e) => set('customBracesType', e.target.value)}
              />
            </Field>
            <Field label="Plan status" hint="Set by the doctor; never changes automatically">
              <Pick
                value={form.planStatus}
                onChange={(v) => set('planStatus', v)}
                options={PLAN_STATUSES.filter(
                  (s) => s !== 'IN_PROGRESS' || form.planStatus === 'IN_PROGRESS'
                )}
              />
            </Field>
            <Field label="Treatment start date">
              <Input
                type="date"
                value={form.treatmentStartDate}
                onChange={(e) => set('treatmentStartDate', e.target.value)}
              />
            </Field>
            <Field label="Estimated completion date">
              <Input
                type="date"
                value={form.estimatedCompletionDate}
                onChange={(e) => set('estimatedCompletionDate', e.target.value)}
              />
            </Field>
            <Field label="Estimated duration (months)">
              <Input
                type="number"
                value={form.estimatedMonths}
                onChange={(e) => set('estimatedMonths', e.target.value)}
              />
            </Field>
            <Field label="Estimated cost">
              <Input
                type="number"
                value={form.estimatedCost}
                onChange={(e) => set('estimatedCost', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Treatment objectives">
            <Textarea value={form.objectives} onChange={(e) => set('objectives', e.target.value)} />
          </Field>
          <Field label="Plan notes">
            <Textarea value={form.planNotes} onChange={(e) => set('planNotes', e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Planned procedures</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              set('procedureList', [
                ...form.procedureList,
                { name: '', description: '', plannedDate: '', status: 'PENDING', notes: '' },
              ])
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Add procedure
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            A planned procedure is not a performed one. Mark it completed only when it has been
            done.
          </p>
          {form.procedureList.map((p: any, i: number) => (
            <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-6">
              <Input
                className="sm:col-span-2"
                placeholder="Procedure name"
                value={p.name}
                onChange={(e) => updateRow('procedureList', i, { name: e.target.value })}
              />
              <Input
                className="sm:col-span-2"
                placeholder="Description"
                value={p.description}
                onChange={(e) => updateRow('procedureList', i, { description: e.target.value })}
              />
              <Input
                type="date"
                value={day(p.plannedDate)}
                onChange={(e) => updateRow('procedureList', i, { plannedDate: e.target.value })}
              />
              <Pick
                value={p.status}
                onChange={(v) => updateRow('procedureList', i, { status: v || 'PENDING' })}
                options={PROCEDURE_STATUSES}
              />
              <Input
                className="sm:col-span-5"
                placeholder="Notes"
                value={p.notes}
                onChange={(e) => updateRow('procedureList', i, { notes: e.target.value })}
              />
              <Button variant="ghost" size="sm" onClick={() => removeRow('procedureList', i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Treatment stages</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              set('stages', [
                ...form.stages,
                {
                  name: '',
                  description: '',
                  expectedStart: '',
                  expectedCompletion: '',
                  status: 'PLANNED',
                  notes: '',
                },
              ])
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Add stage
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.stages.map((s: any, i: number) => (
            <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-6">
              <Input
                className="sm:col-span-2"
                placeholder="Stage name"
                value={s.name}
                onChange={(e) => updateRow('stages', i, { name: e.target.value })}
              />
              <Input
                className="sm:col-span-2"
                placeholder="Description"
                value={s.description}
                onChange={(e) => updateRow('stages', i, { description: e.target.value })}
              />
              <Pick
                value={s.status}
                onChange={(v) => updateRow('stages', i, { status: v || 'PLANNED' })}
                options={STAGE_STATUSES}
              />
              <span />
              <Field label="Expected start" className="sm:col-span-2">
                <Input
                  type="date"
                  value={day(s.expectedStart)}
                  onChange={(e) => updateRow('stages', i, { expectedStart: e.target.value })}
                />
              </Field>
              <Field label="Expected completion" className="sm:col-span-2">
                <Input
                  type="date"
                  value={day(s.expectedCompletion)}
                  onChange={(e) => updateRow('stages', i, { expectedCompletion: e.target.value })}
                />
              </Field>
              <Input
                className="sm:col-span-5"
                placeholder="Notes"
                value={s.notes}
                onChange={(e) => updateRow('stages', i, { notes: e.target.value })}
              />
              <Button variant="ghost" size="sm" onClick={() => removeRow('stages', i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save treatment plan
      </Button>
      <span className="ml-3 text-xs text-muted-foreground">Status: {labelOf(form.planStatus)}</span>
    </div>
  )
}
