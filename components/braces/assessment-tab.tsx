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
  MEDICAL_CONDITIONS,
  ORAL_HABITS,
  OCCLUSION_CLASSES,
  SEVERITIES,
  SEXES,
  SKELETAL_CLASSES,
  type PalmerChart as PalmerChartData,
  labelOf,
  localToday,
} from '@/lib/braces/schema'

import { PalmerChart } from './palmer-chart'
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
  ['overjetMm', 'Overjet'],
  ['overbiteMm', 'Overbite'],
  ['overbitePercent', 'Overbite (%)'],
  ['midlineUpperMm', 'Upper midline discrepancy'],
  ['midlineLowerMm', 'Lower midline discrepancy'],
  ['crowdingUpperMm', 'Upper arch crowding'],
  ['crowdingLowerMm', 'Lower arch crowding'],
  ['spacingUpperMm', 'Upper arch spacing'],
  ['spacingLowerMm', 'Lower arch spacing'],
]

const SEX_VALUES: readonly string[] = SEXES
const sexOf = (gender?: string | null) =>
  gender && SEX_VALUES.includes(gender.toUpperCase()) ? gender.toUpperCase() : ''

const blank = (sex = '') => ({
  assessedAt: localToday(),
  sex,
  medicalConditions: [] as string[],
  medicalOther: '',
  palmerChart: null as PalmerChartData | null,
  doctorId: '',
  chiefComplaint: '',
  clinicalDiagnosis: '',
  severity: '',
  dentalHistory: '',
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

const conditionLabel = (code: string) =>
  code === 'NONE'
    ? 'None'
    : code === 'OTHER'
      ? 'Other'
      : (MEDICAL_CONDITIONS.find((c) => c.value === code)?.label ?? labelOf(code))

/* eslint-disable @typescript-eslint/no-explicit-any */
function medicalSummary(a: any) {
  const parts = ((a.medicalConditions ?? []) as string[]).map(conditionLabel)
  if (a.medicalOther) parts.push(String(a.medicalOther))
  // Assessments saved before the checklist existed only have the free-text note.
  if (!parts.length && a.medicalHistory) return String(a.medicalHistory)
  return parts.join(', ')
}

export function AssessmentTab({ ctx }: { ctx: WorkspaceCtx }) {
  const { toast } = useToast()
  const patientSex = sexOf(ctx.patient?.gender)
  const [form, setForm] = useState<Record<string, any>>(() => blank(patientSex))
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [chartKey, setChartKey] = useState(0)
  const [editing, setEditing] = useState<{ id: string; chart: PalmerChartData | null } | null>(null)
  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }))
  const age = ageFrom(ctx.patient)
  // "None" excludes every other condition; ticking any condition clears "None".
  const toggleCondition = (code: string, on: boolean) =>
    setForm((f) => {
      const current: string[] = f.medicalConditions
      const next =
        code === 'NONE'
          ? on
            ? ['NONE']
            : []
          : on
            ? [...current.filter((c) => c !== 'NONE'), code]
            : current.filter((c) => c !== code)
      return { ...f, medicalConditions: next }
    })

  async function saveChart() {
    if (!editing) return
    const res = await fetch(`/api/patients/${ctx.patientId}/braces/assessments/${editing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ palmerChart: editing.chart }),
    })
    if (res.ok) {
      setEditing(null)
      await ctx.reload()
      toast({ title: 'Chart updated' })
    } else {
      toast({ title: (await res.json()).error || 'Save failed', variant: 'destructive' })
    }
  }

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/patients/${ctx.patientId}/braces/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      setForm(blank(patientSex))
      setChartKey((k) => k + 1)
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <Field
              label="Sex"
              hint={patientSex ? 'From the patient record' : 'Not on the patient record'}
            >
              <Pick value={form.sex} onChange={(v) => set('sex', v)} options={SEXES} />
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
          </div>

          <fieldset className="rounded-lg border p-4">
            <legend className="px-1 text-sm font-semibold">
              Medical History &amp; Existing Conditions
            </legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {MEDICAL_CONDITIONS.map((c) => (
                <label key={c.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.medicalConditions.includes(c.value)}
                    onChange={(e) => toggleCondition(c.value, e.target.checked)}
                  />
                  {c.label}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.medicalConditions.includes('NONE')}
                  onChange={(e) => toggleCondition('NONE', e.target.checked)}
                />
                None
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.medicalConditions.includes('OTHER')}
                  onChange={(e) => toggleCondition('OTHER', e.target.checked)}
                />
                Other
              </label>
            </div>
            {form.medicalConditions.includes('OTHER') && (
              <Input
                className="mt-3 max-w-md"
                aria-label="Other medical condition"
                placeholder="Other condition (allergies, medications…)"
                value={form.medicalOther}
                onChange={(e) => set('medicalOther', e.target.value)}
              />
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Selected conditions are also added to the patient&apos;s medical history.
            </p>
          </fieldset>

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
            <h3 className="mb-1 text-sm font-semibold">Palmer dental chart</h3>
            <p className="mb-2 text-xs text-muted-foreground">
              Write findings freely inside each quadrant, draw, circle or mark. The cross and
              quadrant labels stay fixed.
            </p>
            <PalmerChart
              key={chartKey}
              value={form.palmerChart}
              onChange={(chart) => set('palmerChart', chart)}
              printMeta={{
                title: `Palmer dental chart${ctx.patient ? ` - ${ctx.patient.firstName} ${ctx.patient.lastName}` : ''}`,
                subtitle: `Examination ${form.assessedAt}`,
              }}
            />
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
              const mine = editing && editing.id === a.id ? editing : null
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
                          ['Sex', a.sex ? labelOf(String(a.sex)) : ''],
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
                          ['Medical history', medicalSummary(a)],
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
                      {(a.palmerChart || mine) && (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground">
                            Palmer dental chart
                          </div>
                          {mine ? (
                            <>
                              <PalmerChart
                                value={mine.chart}
                                onChange={(chart) => setEditing({ id: a.id, chart })}
                                printMeta={{
                                  title: `Palmer dental chart${ctx.patient ? ` - ${ctx.patient.firstName} ${ctx.patient.lastName}` : ''}`,
                                  subtitle: `Examination ${showDate(a.assessedAt)}`,
                                }}
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={saveChart}>
                                  Save chart changes
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditing(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <PalmerChart
                                value={a.palmerChart}
                                printMeta={{
                                  title: `Palmer dental chart${ctx.patient ? ` - ${ctx.patient.firstName} ${ctx.patient.lastName}` : ''}`,
                                  subtitle: `Examination ${showDate(a.assessedAt)}`,
                                }}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditing({ id: a.id, chart: a.palmerChart })}
                              >
                                Edit chart
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                      {!a.palmerChart && !mine && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing({ id: a.id, chart: null })}
                        >
                          Add chart to this assessment
                        </Button>
                      )}
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
