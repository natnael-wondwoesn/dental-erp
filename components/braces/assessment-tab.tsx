'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  CROSSBITE_TYPES,
  FACIAL_PROFILES,
  FINDINGS,
  ORAL_HABITS,
  OCCLUSION_CLASSES,
  SEVERITIES,
  SKELETAL_CLASSES,
  labelOf,
  localToday,
} from '@/lib/braces/schema'

import {
  Chips,
  EmptyNote,
  Field,
  Pick,
  ageFrom,
  doctorName,
  showDate,
  type WorkspaceCtx,
} from './shared'

const MEASURES: [string, string][] = [
  ['overjetMm', 'Overjet (mm)'],
  ['overbiteMm', 'Overbite (mm)'],
  ['overbitePercent', 'Overbite (%)'],
  ['midlineUpperMm', 'Upper midline discrepancy (mm)'],
  ['midlineLowerMm', 'Lower midline discrepancy (mm)'],
  ['crowdingUpperMm', 'Upper arch crowding (mm)'],
  ['crowdingLowerMm', 'Lower arch crowding (mm)'],
  ['spacingUpperMm', 'Upper arch spacing (mm)'],
  ['spacingLowerMm', 'Lower arch spacing (mm)'],
]

const blank = () => ({
  assessedAt: localToday(),
  doctorId: '',
  chiefComplaint: '',
  clinicalDiagnosis: '',
  severity: '',
  dentalHistory: '',
  medicalHistory: '',
  facialProfile: '',
  skeletalClass: '',
  molarRight: '',
  molarLeft: '',
  canineRight: '',
  canineLeft: '',
  crossbite: [] as string[],
  oralHabits: [] as string[],
  findings: [] as string[],
  notes: '',
  ...Object.fromEntries(MEASURES.map(([k]) => [k, ''])),
})

/* eslint-disable @typescript-eslint/no-explicit-any */
export function AssessmentTab({ ctx }: { ctx: WorkspaceCtx }) {
  const { toast } = useToast()
  const [form, setForm] = useState<Record<string, any>>(blank)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }))
  const age = ageFrom(ctx.patient)

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/patients/${ctx.patientId}/braces/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      setForm(blank())
      await ctx.reload()
      toast({ title: 'Assessment saved as a new dated record' })
    } else {
      toast({ title: (await res.json()).error || 'Save failed', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>New orthodontic assessment</CardTitle>
          <p className="text-sm text-muted-foreground">
            Each assessment is saved as its own dated record. Earlier assessments are never
            overwritten, so progress can be compared over time.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Assessment date">
              <Input
                type="date"
                value={form.assessedAt}
                onChange={(e) => set('assessedAt', e.target.value)}
              />
            </Field>
            <Field label="Examining doctor">
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
            <Field label="Patient age" hint="Calculated from date of birth">
              <Input value={age != null ? `${age} years` : 'Not recorded'} readOnly />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Chief complaint">
              <Textarea
                value={form.chiefComplaint}
                onChange={(e) => set('chiefComplaint', e.target.value)}
              />
            </Field>
            <Field label="Clinical diagnosis">
              <Textarea
                value={form.clinicalDiagnosis}
                onChange={(e) => set('clinicalDiagnosis', e.target.value)}
              />
            </Field>
            <Field label="Dental history" hint="Previous orthodontic treatment, extractions">
              <Textarea
                value={form.dentalHistory}
                onChange={(e) => set('dentalHistory', e.target.value)}
              />
            </Field>
            <Field label="Medical history" hint="Conditions, allergies, medications">
              <Textarea
                value={form.medicalHistory}
                onChange={(e) => set('medicalHistory', e.target.value)}
              />
            </Field>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Clinical findings (descriptive)</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Facial profile">
                <Pick
                  value={form.facialProfile}
                  onChange={(v) => set('facialProfile', v)}
                  options={FACIAL_PROFILES}
                />
              </Field>
              <Field label="Skeletal classification">
                <Pick
                  value={form.skeletalClass}
                  onChange={(v) => set('skeletalClass', v)}
                  options={SKELETAL_CLASSES}
                />
              </Field>
              <Field label="Severity">
                <Pick
                  value={form.severity}
                  onChange={(v) => set('severity', v)}
                  options={SEVERITIES}
                />
              </Field>
              <Field label="Molar relationship, right">
                <Pick
                  value={form.molarRight}
                  onChange={(v) => set('molarRight', v)}
                  options={OCCLUSION_CLASSES}
                />
              </Field>
              <Field label="Molar relationship, left">
                <Pick
                  value={form.molarLeft}
                  onChange={(v) => set('molarLeft', v)}
                  options={OCCLUSION_CLASSES}
                />
              </Field>
              <span />
              <Field label="Canine relationship, right">
                <Pick
                  value={form.canineRight}
                  onChange={(v) => set('canineRight', v)}
                  options={OCCLUSION_CLASSES}
                />
              </Field>
              <Field label="Canine relationship, left">
                <Pick
                  value={form.canineLeft}
                  onChange={(v) => set('canineLeft', v)}
                  options={OCCLUSION_CLASSES}
                />
              </Field>
            </div>
            <div className="mt-4 space-y-3">
              <Field label="Orthodontic findings">
                <Chips
                  options={FINDINGS}
                  value={form.findings}
                  onChange={(v) => set('findings', v)}
                />
              </Field>
              <Field label="Crossbite">
                <Chips
                  options={CROSSBITE_TYPES}
                  value={form.crossbite}
                  onChange={(v) => set('crossbite', v)}
                />
              </Field>
              <Field label="Oral habits">
                <Chips
                  options={ORAL_HABITS}
                  value={form.oralHabits}
                  onChange={(v) => set('oralHabits', v)}
                />
              </Field>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Measurements (compared over time)</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {MEASURES.map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input
                    type="number"
                    step="0.1"
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </Field>
              ))}
            </div>
          </div>

          <Field label="Assessment notes">
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save assessment
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assessment history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!ctx.data || ctx.data.assessments.length === 0 ? (
            <EmptyNote>No assessments recorded yet.</EmptyNote>
          ) : (
            ctx.data.assessments.map((a, index) => {
              const prev = ctx.data!.assessments[index + 1]
              const isOpen = open === a.id
              return (
                <div key={a.id} className="rounded-lg border">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between p-3 text-left text-sm"
                    onClick={() => setOpen(isOpen ? null : a.id)}
                  >
                    <span className="font-medium">{showDate(a.assessedAt)}</span>
                    <span className="text-muted-foreground">
                      {a.clinicalDiagnosis || a.chiefComplaint || 'Assessment'}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="space-y-3 border-t p-3 text-sm">
                      <div className="grid gap-2 sm:grid-cols-3">
                        {[
                          ['Facial profile', a.facialProfile],
                          ['Skeletal class', a.skeletalClass],
                          ['Severity', a.severity],
                          [
                            'Molar R / L',
                            [a.molarRight, a.molarLeft].filter(Boolean).map(labelOf).join(' / '),
                          ],
                          [
                            'Canine R / L',
                            [a.canineRight, a.canineLeft].filter(Boolean).map(labelOf).join(' / '),
                          ],
                          ['Findings', (a.findings ?? []).map(labelOf).join(', ')],
                          ['Crossbite', (a.crossbite ?? []).map(labelOf).join(', ')],
                          ['Oral habits', (a.oralHabits ?? []).map(labelOf).join(', ')],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <div className="text-xs text-muted-foreground">{k}</div>
                            <div>
                              {v
                                ? k === 'Facial profile' ||
                                  k === 'Skeletal class' ||
                                  k === 'Severity'
                                  ? labelOf(String(v))
                                  : v
                                : '-'}
                            </div>
                          </div>
                        ))}
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="py-1">Measurement</th>
                            <th>This assessment</th>
                            <th>Previous</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MEASURES.map(([key, label]) =>
                            a[key] == null && prev?.[key] == null ? null : (
                              <tr key={key} className="border-t">
                                <td className="py-1">{label}</td>
                                <td>{a[key] ?? '-'}</td>
                                <td>{prev?.[key] ?? '-'}</td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                      {a.notes && <p className="whitespace-pre-wrap">{a.notes}</p>}
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
