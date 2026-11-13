'use client'

import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { RETAINER_CONDITIONS, RETAINER_TYPES, RETAINER_WEAR, localToday } from '@/lib/braces/schema'

import {
  EmptyNote,
  Field,
  Pick,
  casePayload,
  day,
  doctorName,
  showDate,
  type BracesData,
  type WorkspaceCtx,
} from './shared'
import { labelOf } from '@/lib/braces/schema'

/* eslint-disable @typescript-eslint/no-explicit-any */
export function RetentionTab({ ctx }: { ctx: WorkspaceCtx }) {
  const data = ctx.data
  const { toast } = useToast()
  const [form, setForm] = useState<any>(() => ({
    removalDate: day(data?.removalDate),
    retainerType: data?.retainerType ?? '',
    upperRetainer: data?.upperRetainer ?? '',
    lowerRetainer: data?.lowerRetainer ?? '',
    retainerDeliveryDate: day(data?.retainerDeliveryDate),
    retainerWear: data?.retainerWear ?? '',
    retainerCondition: data?.retainerCondition ?? '',
    retainerInstructions: data?.retainerInstructions ?? '',
    retentionNotes: data?.retentionNotes ?? '',
  }))
  const [check, setCheck] = useState<any>({
    checkDate: localToday(),
    retainerCondition: '',
    compliance: '',
    relapse: '',
    notes: '',
    doctorId: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: unknown) => setForm((f: any) => ({ ...f, [k]: v }))

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
    const res = await fetch(`/api/patients/${ctx.patientId}/braces`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(casePayload(data as BracesData, form)),
    })
    setSaving(false)
    if (res.ok) {
      await ctx.reload()
      toast({ title: 'Retention plan saved' })
    } else toast({ title: (await res.json()).error || 'Save failed', variant: 'destructive' })
  }

  async function addCheck() {
    const res = await fetch(`/api/patients/${ctx.patientId}/braces/retention-checks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(check),
    })
    if (res.ok) {
      setCheck({
        checkDate: localToday(),
        retainerCondition: '',
        compliance: '',
        relapse: '',
        notes: '',
        doctorId: '',
      })
      await ctx.reload()
      toast({ title: 'Retention check recorded' })
    } else toast({ title: (await res.json()).error || 'Could not save', variant: 'destructive' })
  }

  async function removeCheck(id: string) {
    if (!confirm('Delete this retention check? This is logged in the audit history.')) return
    const res = await fetch(`/api/patients/${ctx.patientId}/braces/retention-checks/${id}`, {
      method: 'DELETE',
    })
    if (res.ok) await ctx.reload()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Braces removal and retainers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Debonding date (braces removed)">
              <Input
                type="date"
                value={form.removalDate}
                onChange={(e) => set('removalDate', e.target.value)}
              />
            </Field>
            <Field label="Retainer type">
              <Pick
                value={form.retainerType}
                onChange={(v) => set('retainerType', v)}
                options={RETAINER_TYPES.filter(
                  (t) => t !== 'REMOVABLE' || form.retainerType === 'REMOVABLE'
                )}
              />
            </Field>
            <Field label="Retainer delivery date">
              <Input
                type="date"
                value={form.retainerDeliveryDate}
                onChange={(e) => set('retainerDeliveryDate', e.target.value)}
              />
            </Field>
            <Field label="Upper retainer (type and status)">
              <Input
                value={form.upperRetainer}
                onChange={(e) => set('upperRetainer', e.target.value)}
              />
            </Field>
            <Field label="Lower retainer (type and status)">
              <Input
                value={form.lowerRetainer}
                onChange={(e) => set('lowerRetainer', e.target.value)}
              />
            </Field>
            <Field label="Retainer condition">
              <Pick
                value={form.retainerCondition}
                onChange={(v) => set('retainerCondition', v)}
                options={RETAINER_CONDITIONS}
              />
            </Field>
            <Field label="Wear instructions">
              <Pick
                value={RETAINER_WEAR.includes(form.retainerWear) ? form.retainerWear : ''}
                onChange={(v) => set('retainerWear', v)}
                options={RETAINER_WEAR}
              />
            </Field>
          </div>
          <Field label="Instructions given to the patient">
            <Textarea
              value={form.retainerInstructions}
              onChange={(e) => set('retainerInstructions', e.target.value)}
            />
          </Field>
          <Field label="Retention notes">
            <Textarea
              value={form.retentionNotes}
              onChange={(e) => set('retentionNotes', e.target.value)}
            />
          </Field>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save retention plan
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retention follow-up checks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
            <Field label="Check date">
              <Input
                type="date"
                value={check.checkDate}
                onChange={(e) => setCheck({ ...check, checkDate: e.target.value })}
              />
            </Field>
            <Field label="Retainer condition">
              <Pick
                value={check.retainerCondition}
                onChange={(v) => setCheck({ ...check, retainerCondition: v })}
                options={RETAINER_CONDITIONS}
              />
            </Field>
            <Field label="Doctor">
              <select
                value={check.doctorId}
                onChange={(e) => setCheck({ ...check, doctorId: e.target.value })}
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
            <Field label="Patient compliance">
              <Input
                value={check.compliance}
                onChange={(e) => setCheck({ ...check, compliance: e.target.value })}
                placeholder="e.g. wears every night"
              />
            </Field>
            <Field label="Relapse or movement observed" className="sm:col-span-2">
              <Input
                value={check.relapse}
                onChange={(e) => setCheck({ ...check, relapse: e.target.value })}
              />
            </Field>
            <Field label="Notes" className="sm:col-span-3">
              <Textarea
                value={check.notes}
                onChange={(e) => setCheck({ ...check, notes: e.target.value })}
              />
            </Field>
            <div>
              <Button onClick={addCheck}>Add check</Button>
            </div>
          </div>
          {data.retentionChecks.length === 0 ? (
            <EmptyNote>No retention checks yet.</EmptyNote>
          ) : (
            data.retentionChecks.map((c: any) => (
              <div
                key={c.id}
                className="flex items-start justify-between rounded-lg border p-3 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {showDate(c.checkDate)}
                    {c.retainerCondition ? ` · ${labelOf(c.retainerCondition)}` : ''}
                  </div>
                  {c.compliance && <div>Compliance: {c.compliance}</div>}
                  {c.relapse && <div>Relapse/movement: {c.relapse}</div>}
                  {c.notes && <div className="text-muted-foreground">{c.notes}</div>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeCheck(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
