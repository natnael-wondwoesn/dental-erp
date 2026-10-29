'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Plus, Save, Trash2, Upload } from 'lucide-react'

import { DentalChart } from '@/components/dental-chart'
import { useTenantAccess } from '@/components/saas/tenant-access'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  BRACES_TYPES,
  FINDINGS,
  PLAN_STATUSES,
  RETAINER_TYPES,
  SEVERITIES,
  STAGE_STATUSES,
  VISIT_TYPES,
} from '@/lib/braces/schema'

type Stage = {
  name: string
  procedure: string
  expectedDate: string
  status: string
  notes: string
}
type CaseForm = {
  chiefComplaint: string
  findings: string[]
  severity: string
  clinicalDiagnosis: string
  assessmentNotes: string
  recordsNotes: string
  bracesType: string
  objectives: string
  plannedProcedures: string[]
  stages: Stage[]
  estimatedMonths: string
  estimatedCost: string
  planNotes: string
  planStatus: string
  removalDate: string
  retainerType: string
  retainerInstructions: string
  retentionFollowUps: string[]
  retentionNotes: string
}
type VisitForm = {
  visitDate: string
  visitType: string
  wireAdjustments: string
  applianceChanges: string
  clinicalProgress: string
  patientConcerns: string
  nextAppointment: string
  doctorId: string
}
type Visit = VisitForm & { id: string; doctor?: { firstName: string; lastName: string } | null }
type Doc = { id: string; originalName: string; documentType: string; description?: string }

const today = () => new Date().toISOString().slice(0, 10)
const day = (value?: string | null) => (value ? String(value).slice(0, 10) : '')
const label = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')

const emptyCase: CaseForm = {
  chiefComplaint: '',
  findings: [],
  severity: '',
  clinicalDiagnosis: '',
  assessmentNotes: '',
  recordsNotes: '',
  bracesType: '',
  objectives: '',
  plannedProcedures: [],
  stages: [],
  estimatedMonths: '',
  estimatedCost: '',
  planNotes: '',
  planStatus: 'DRAFT',
  removalDate: '',
  retainerType: '',
  retainerInstructions: '',
  retentionFollowUps: [],
  retentionNotes: '',
}
const emptyVisit = (): VisitForm => ({
  visitDate: today(),
  visitType: 'ADJUSTMENT',
  wireAdjustments: '',
  applianceChanges: '',
  clinicalProgress: '',
  patientConcerns: '',
  nextAppointment: '',
  doctorId: '',
})

function Pick({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  id,
}: {
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  placeholder?: string
  id?: string
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {label(option)}
        </option>
      ))}
    </select>
  )
}

export default function BracesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const access = useTenantAccess()
  const { toast } = useToast()
  const [form, setForm] = useState<CaseForm>(emptyCase)
  const [visits, setVisits] = useState<Visit[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [doctors, setDoctors] = useState<{ id: string; firstName: string; lastName: string }[]>([])
  const [visit, setVisit] = useState<VisitForm>(emptyVisit)
  const [procedure, setProcedure] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasCase, setHasCase] = useState(false)

  const set = <K extends keyof CaseForm>(key: K, value: CaseForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const load = useCallback(async () => {
    const [caseRes, docRes, doctorRes] = await Promise.all([
      fetch(`/api/patients/${id}/braces`),
      fetch(`/api/patients/${id}/documents`),
      fetch('/api/staff/doctors'),
    ])
    if (caseRes.ok) {
      const { bracesCase } = await caseRes.json()
      setHasCase(!!bracesCase)
      if (bracesCase) {
        setForm({
          ...emptyCase,
          ...Object.fromEntries(
            Object.entries(bracesCase).map(([key, value]) => [
              key,
              value ?? emptyCase[key as keyof CaseForm],
            ])
          ),
          estimatedMonths: bracesCase.estimatedMonths?.toString() ?? '',
          estimatedCost: bracesCase.estimatedCost?.toString() ?? '',
          removalDate: day(bracesCase.removalDate),
          retentionFollowUps: (bracesCase.retentionFollowUps ?? []).map(day),
          stages: bracesCase.stages ?? [],
        } as CaseForm)
        setVisits(bracesCase.visits ?? [])
      }
    }
    if (docRes.ok) {
      const { documents } = await docRes.json()
      setDocs(documents.filter((d: Doc) => d.description?.startsWith('Braces')))
    }
    if (doctorRes.ok) {
      const body = await doctorRes.json()
      setDoctors(Array.isArray(body) ? body : (body.doctors ?? []))
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (access && !access.modules.includes('braces' as never)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Braces module is not enabled</CardTitle>
          <CardDescription>Ask your administrator to enable it for this clinic.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  async function saveCase() {
    setSaving(true)
    const res = await fetch(`/api/patients/${id}/braces`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      setHasCase(true)
      toast({ title: 'Braces record saved' })
    } else {
      toast({ title: (await res.json()).error || 'Save failed', variant: 'destructive' })
    }
  }

  async function addVisit() {
    const res = await fetch(`/api/patients/${id}/braces/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visit),
    })
    if (res.ok) {
      setVisit(emptyVisit())
      await load()
      toast({ title: 'Visit recorded' })
    } else {
      toast({ title: (await res.json()).error || 'Could not save visit', variant: 'destructive' })
    }
  }

  async function removeVisit(visitId: string) {
    if (!confirm('Delete this visit record?')) return
    const res = await fetch(`/api/patients/${id}/braces/visits/${visitId}`, { method: 'DELETE' })
    if (res.ok) await load()
  }

  async function upload(file: File, documentType: 'PHOTO' | 'XRAY') {
    const body = new FormData()
    body.append('file', file)
    body.append('documentType', documentType)
    body.append('description', `Braces ${documentType === 'PHOTO' ? 'photograph' : 'x-ray'}`)
    const res = await fetch(`/api/patients/${id}/documents`, { method: 'POST', body })
    if (res.ok) await load()
    else toast({ title: (await res.json()).error || 'Upload failed', variant: 'destructive' })
  }

  if (loading) return <Loader2 className="m-8 h-6 w-6 animate-spin" />

  const fileList = (type: string) => docs.filter((d) => d.documentType === type)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <Link
        href={`/patients/${id}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#086be6]"
      >
        <ArrowLeft className="h-4 w-4" /> Patient
      </Link>
      <h1 className="text-2xl font-semibold">Braces department</h1>

      <Card>
        <CardHeader>
          <CardTitle>1. Orthodontic assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="chiefComplaint">Chief complaint</Label>
            <Textarea
              id="chiefComplaint"
              value={form.chiefComplaint}
              onChange={(e) => set('chiefComplaint', e.target.value)}
            />
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Orthodontic findings</legend>
            <div className="flex flex-wrap gap-4">
              {FINDINGS.map((finding) => (
                <label key={finding} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.findings.includes(finding)}
                    onChange={(e) =>
                      set(
                        'findings',
                        e.target.checked
                          ? [...form.findings, finding]
                          : form.findings.filter((f) => f !== finding)
                      )
                    }
                  />
                  {label(finding)}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <Label htmlFor="severity">Severity</Label>
            <Pick
              id="severity"
              value={form.severity}
              onChange={(v) => set('severity', v)}
              options={SEVERITIES}
            />
          </div>
          <div>
            <Label htmlFor="clinicalDiagnosis">Clinical diagnosis</Label>
            <Textarea
              id="clinicalDiagnosis"
              value={form.clinicalDiagnosis}
              onChange={(e) => set('clinicalDiagnosis', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="assessmentNotes">Doctor&apos;s notes</Label>
            <Textarea
              id="assessmentNotes"
              value={form.assessmentNotes}
              onChange={(e) => set('assessmentNotes', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Dental records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              ['PHOTO', 'Dental photographs'],
              ['XRAY', 'Dental X-rays'],
            ] as const
          ).map(([type, title]) => (
            <div key={type}>
              <Label className="mb-1 flex items-center gap-2">
                <Upload className="h-4 w-4" /> {title}
              </Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                aria-label={title}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) upload(file, type)
                  e.target.value = ''
                }}
              />
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                {fileList(type).map((d) => (
                  <li key={d.id}>{d.originalName}</li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <Label>Tooth chart</Label>
            <DentalChart patientId={id} />
          </div>
          <div>
            <Label htmlFor="recordsNotes">Additional notes</Label>
            <Textarea
              id="recordsNotes"
              value={form.recordsNotes}
              onChange={(e) => set('recordsNotes', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Treatment plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="bracesType">Type of braces</Label>
              <Pick
                id="bracesType"
                value={form.bracesType}
                onChange={(v) => set('bracesType', v)}
                options={BRACES_TYPES}
              />
            </div>
            <div>
              <Label htmlFor="planStatus">Plan status</Label>
              <Pick
                id="planStatus"
                value={form.planStatus}
                onChange={(v) => set('planStatus', v || 'DRAFT')}
                options={PLAN_STATUSES}
              />
            </div>
            <div>
              <Label htmlFor="estimatedMonths">Estimated duration (months)</Label>
              <Input
                id="estimatedMonths"
                type="number"
                min={0}
                value={form.estimatedMonths}
                onChange={(e) => set('estimatedMonths', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="estimatedCost">Estimated cost</Label>
              <Input
                id="estimatedCost"
                type="number"
                min={0}
                step="0.01"
                value={form.estimatedCost}
                onChange={(e) => set('estimatedCost', e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="objectives">Treatment objectives</Label>
            <Textarea
              id="objectives"
              value={form.objectives}
              onChange={(e) => set('objectives', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="procedure">Planned procedures</Label>
            <div className="flex gap-2">
              <Input
                id="procedure"
                value={procedure}
                onChange={(e) => setProcedure(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && procedure.trim()) {
                    e.preventDefault()
                    set('plannedProcedures', [...form.plannedProcedures, procedure.trim()])
                    setProcedure('')
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!procedure.trim()) return
                  set('plannedProcedures', [...form.plannedProcedures, procedure.trim()])
                  setProcedure('')
                }}
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {form.plannedProcedures.map((item, index) => (
                <li
                  key={`${item}-${index}`}
                  className="flex items-center justify-between rounded border px-3 py-1"
                >
                  {item}
                  <button
                    type="button"
                    aria-label={`Remove ${item}`}
                    onClick={() =>
                      set(
                        'plannedProcedures',
                        form.plannedProcedures.filter((_, i) => i !== index)
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <Label>Treatment stages</Label>
            {form.stages.map((stage, index) => {
              const update = (patch: Partial<Stage>) =>
                set(
                  'stages',
                  form.stages.map((s, i) => (i === index ? { ...s, ...patch } : s))
                )
              return (
                <div key={index} className="grid gap-2 rounded border p-3 sm:grid-cols-2">
                  <Input
                    placeholder="Stage name"
                    aria-label={`Stage ${index + 1} name`}
                    value={stage.name}
                    onChange={(e) => update({ name: e.target.value })}
                  />
                  <Input
                    placeholder="Procedure"
                    aria-label={`Stage ${index + 1} procedure`}
                    value={stage.procedure}
                    onChange={(e) => update({ procedure: e.target.value })}
                  />
                  <Input
                    type="date"
                    aria-label={`Stage ${index + 1} expected date`}
                    value={stage.expectedDate}
                    onChange={(e) => update({ expectedDate: e.target.value })}
                  />
                  <Pick
                    value={stage.status}
                    onChange={(v) => update({ status: v || 'PLANNED' })}
                    options={STAGE_STATUSES}
                  />
                  <Textarea
                    className="sm:col-span-2"
                    placeholder="Notes"
                    aria-label={`Stage ${index + 1} notes`}
                    value={stage.notes}
                    onChange={(e) => update({ notes: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="sm:col-span-2 justify-self-end"
                    onClick={() =>
                      set(
                        'stages',
                        form.stages.filter((_, i) => i !== index)
                      )
                    }
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Remove stage
                  </Button>
                </div>
              )
            })}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                set('stages', [
                  ...form.stages,
                  { name: '', procedure: '', expectedDate: '', status: 'PLANNED', notes: '' },
                ])
              }
            >
              <Plus className="mr-2 h-4 w-4" /> Add stage
            </Button>
          </div>

          <div>
            <Label htmlFor="planNotes">Doctor&apos;s notes</Label>
            <Textarea
              id="planNotes"
              value={form.planNotes}
              onChange={(e) => set('planNotes', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. Retention plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="removalDate">Braces removal date</Label>
              <Input
                id="removalDate"
                type="date"
                value={form.removalDate}
                onChange={(e) => set('removalDate', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="retainerType">Retainer type</Label>
              <Pick
                id="retainerType"
                value={form.retainerType}
                onChange={(v) => set('retainerType', v)}
                options={RETAINER_TYPES}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="retainerInstructions">Retainer instructions</Label>
            <Textarea
              id="retainerInstructions"
              value={form.retainerInstructions}
              onChange={(e) => set('retainerInstructions', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="followUp">Follow-up appointments</Label>
            <div className="flex gap-2">
              <Input
                id="followUp"
                type="date"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!followUp) return
                  set('retentionFollowUps', [...form.retentionFollowUps, followUp])
                  setFollowUp('')
                }}
              >
                <Plus className="h-4 w-4" /> Add date
              </Button>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {form.retentionFollowUps.map((date, index) => (
                <li
                  key={`${date}-${index}`}
                  className="flex items-center justify-between rounded border px-3 py-1"
                >
                  {date}
                  <button
                    type="button"
                    aria-label={`Remove ${date}`}
                    onClick={() =>
                      set(
                        'retentionFollowUps',
                        form.retentionFollowUps.filter((_, i) => i !== index)
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Label htmlFor="retentionNotes">Retention notes</Label>
            <Textarea
              id="retentionNotes"
              value={form.retentionNotes}
              onChange={(e) => set('retentionNotes', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveCase} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save braces record
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>4. Treatment progress and follow-up visits</CardTitle>
          <CardDescription>
            {hasCase
              ? 'One record per appointment.'
              : 'Save the record above before adding visits.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="visitDate">Visit date</Label>
              <Input
                id="visitDate"
                type="date"
                value={visit.visitDate}
                onChange={(e) => setVisit({ ...visit, visitDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="visitType">Visit type</Label>
              <Pick
                id="visitType"
                value={visit.visitType}
                onChange={(v) => setVisit({ ...visit, visitType: v || 'ADJUSTMENT' })}
                options={VISIT_TYPES}
              />
            </div>
            {(
              [
                ['wireAdjustments', 'Wire adjustments'],
                ['applianceChanges', 'Appliance changes'],
                ['clinicalProgress', 'Clinical progress'],
                ['patientConcerns', 'Patient concerns'],
              ] as const
            ).map(([key, title]) => (
              <div key={key}>
                <Label htmlFor={key}>{title}</Label>
                <Textarea
                  id={key}
                  value={visit[key]}
                  onChange={(e) => setVisit({ ...visit, [key]: e.target.value })}
                />
              </div>
            ))}
            <div>
              <Label htmlFor="nextAppointment">Next appointment</Label>
              <Input
                id="nextAppointment"
                type="date"
                value={visit.nextAppointment}
                onChange={(e) => setVisit({ ...visit, nextAppointment: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="doctorId">Doctor</Label>
              <select
                id="doctorId"
                value={visit.doctorId}
                onChange={(e) => setVisit({ ...visit, doctorId: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select doctor…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.firstName} {d.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button type="button" onClick={addVisit} disabled={!hasCase}>
            <Plus className="mr-2 h-4 w-4" /> Add visit
          </Button>

          <ul className="space-y-3">
            {visits.map((v) => (
              <li key={v.id} className="rounded border p-3 text-sm">
                <div className="flex items-center justify-between font-medium">
                  <span>
                    {day(v.visitDate)} · {label(v.visitType)}
                    {v.doctor && ` · Dr. ${v.doctor.firstName} ${v.doctor.lastName}`}
                  </span>
                  <button type="button" aria-label="Delete visit" onClick={() => removeVisit(v.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {v.wireAdjustments && <p>Wire: {v.wireAdjustments}</p>}
                {v.applianceChanges && <p>Appliance: {v.applianceChanges}</p>}
                {v.clinicalProgress && <p>Progress: {v.clinicalProgress}</p>}
                {v.patientConcerns && <p>Concerns: {v.patientConcerns}</p>}
                {v.nextAppointment && <p>Next: {day(v.nextAppointment)}</p>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
