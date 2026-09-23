'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, FileImage, Loader2, Printer, Save, Upload } from 'lucide-react'

import { DentalChart } from '@/components/dental-chart'
import { SignaturePad } from '@/components/forms/signature-pad'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

type ChartForm = {
  visitDate: string
  chiefComplaint: string
  historyPresentIllness: string
  pastMedicalHistory: string
  medicalAlerts: string
  pastDentalHistory: string
  socialFamilyHistory: string
  bloodPressure: string
  heartRate: string
  temperature: string
  extraOralExam: string
  intraOralExam: string
  radiographNotes: string
  diagnosis: string
  treatmentPlan: string
  estimatedCost: string
  completedProcedures: string
  materialsAnesthesia: string
  postOpInstructions: string
  nextVisit: string
  patientConsentName: string
}

type ChartResponse = {
  patient: {
    id: string
    patientId: string
    fullName: string
    age: number | null
    sex: string | null
    medicalAlerts: string
    medicalHistory: Record<string, unknown> | null
  }
  radiographs: Array<{
    id: string
    originalName: string
    description: string | null
    filePath: string
    createdAt: string
  }>
  charts: Array<{
    id: string
    createdAt: string
    signedAt: string | null
    data: ChartForm & { chartNo: string; diagnosis: string; clinicalSummary: string }
  }>
}

const blankForm = (): ChartForm => ({
  visitDate: new Date().toISOString().slice(0, 10),
  chiefComplaint: '',
  historyPresentIllness: '',
  pastMedicalHistory: '',
  medicalAlerts: '',
  pastDentalHistory: '',
  socialFamilyHistory: '',
  bloodPressure: '',
  heartRate: '',
  temperature: '',
  extraOralExam: '',
  intraOralExam: '',
  radiographNotes: '',
  diagnosis: '',
  treatmentPlan: '',
  estimatedCost: '',
  completedProcedures: '',
  materialsAnesthesia: '',
  postOpInstructions: '',
  nextVisit: '',
  patientConsentName: '',
})

function Field({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function historyText(history: Record<string, unknown> | null) {
  if (!history) return ''
  return [
    history.otherConditions,
    history.currentMedications && `Current medication: ${history.currentMedications}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function dentalHistoryText(history: Record<string, unknown> | null) {
  if (!history) return ''
  return [
    history.previousDentalWork,
    history.lastDentalVisit && `Last dental visit: ${String(history.lastDentalVisit).slice(0, 10)}`,
    history.dentalAnxietyLevel != null && `Dental anxiety level: ${history.dentalAnxietyLevel}/10`,
  ]
    .filter(Boolean)
    .join('\n')
}

function socialHistoryText(history: Record<string, unknown> | null) {
  if (!history) return ''
  return [
    `Smoking: ${history.smokingStatus || 'not recorded'}`,
    `Alcohol: ${history.alcoholConsumption || 'not recorded'}`,
    history.tobaccoChewing && 'Tobacco chewing',
    history.familyDentalHistory,
  ]
    .filter(Boolean)
    .join('\n')
}

export default function PatientClinicalChartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { toast } = useToast()
  const [data, setData] = useState<ChartResponse | null>(null)
  const [form, setForm] = useState<ChartForm>(blankForm)
  const [signature, setSignature] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadDescription, setUploadDescription] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/patients/${id}/clinical-chart`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to load chart')
      setData(result)
      setForm((current) => ({
        ...current,
        medicalAlerts: current.medicalAlerts || result.patient.medicalAlerts || '',
        pastMedicalHistory:
          current.pastMedicalHistory || historyText(result.patient.medicalHistory),
        pastDentalHistory:
          current.pastDentalHistory || dentalHistoryText(result.patient.medicalHistory),
        socialFamilyHistory:
          current.socialFamilyHistory || socialHistoryText(result.patient.medicalHistory),
        patientConsentName: current.patientConsentName || result.patient.fullName,
      }))
    } catch (cause) {
      toast({
        variant: 'destructive',
        title: 'Chart unavailable',
        description: cause instanceof Error ? cause.message : 'Failed to load chart',
      })
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => {
    void load()
  }, [load])
  const update = (key: keyof ChartForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))
  const alerts = useMemo(
    () => form.medicalAlerts || data?.patient.medicalAlerts || 'No medical alerts recorded',
    [data, form.medicalAlerts]
  )

  const save = async () => {
    if (!form.chiefComplaint.trim() || !form.diagnosis.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing clinical data',
        description: 'Chief complaint and diagnosis are required.',
      })
      return
    }
    setSaving(true)
    try {
      const response = await fetch(`/api/patients/${id}/clinical-chart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, signature }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to save chart')
      toast({ title: 'Clinical chart saved', description: result.chart.data.chartNo })
      await load()
      window.open(
        `/api/patients/${id}/clinical-chart/${result.chart.id}/print`,
        '_blank',
        'noopener,noreferrer'
      )
    } catch (cause) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: cause instanceof Error ? cause.message : 'Failed to save chart',
      })
    } finally {
      setSaving(false)
    }
  }

  const uploadRadiograph = async () => {
    if (!uploadFile) return
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', uploadFile)
      body.append('documentType', 'XRAY')
      body.append('description', uploadDescription)
      const response = await fetch(`/api/patients/${id}/documents`, { method: 'POST', body })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Upload failed')
      setUploadFile(null)
      setUploadDescription('')
      toast({ title: 'Radiograph uploaded' })
      await load()
    } catch (cause) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: cause instanceof Error ? cause.message : 'Upload failed',
      })
    } finally {
      setUploading(false)
    }
  }

  if (loading)
    return <div className="p-8 text-sm text-muted-foreground">Loading dental patient chart...</div>
  if (!data)
    return <div className="p-8 text-sm text-destructive">Dental patient chart unavailable.</div>

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link href={`/patients/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Patient record
          </Link>
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save and prepare print
        </Button>
      </div>

      <section className="sticky top-2 z-20 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div>
            <h1 className="text-xl font-bold">{data.patient.fullName}</h1>
            <p className="text-sm text-slate-600">
              MRN {data.patient.patientId} · {data.patient.age || '-'} / {data.patient.sex || '-'}
            </p>
          </div>
          <div className="flex min-w-0 flex-1 items-start gap-2 text-sm font-semibold text-red-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>MEDICAL ALERTS: {alerts}</span>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>1 Patient History and Background</CardTitle>
          <CardDescription>
            Patient-reported reason, symptoms, health, dental, social and family history.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-2">
          <Field
            label="Chief Complaint (CC) *"
            value={form.chiefComplaint}
            onChange={(value) => update('chiefComplaint', value)}
            placeholder="Patient's own words"
          />
          <Field
            label="History of Present Illness (HPI)"
            value={form.historyPresentIllness}
            onChange={(value) => update('historyPresentIllness', value)}
            placeholder="Onset, duration, triggers, severity and pattern"
          />
          <Field
            label="Past Medical History (PMH)"
            value={form.pastMedicalHistory}
            onChange={(value) => update('pastMedicalHistory', value)}
          />
          <Field
            label="Medical Alerts and Allergies"
            value={form.medicalAlerts}
            onChange={(value) => update('medicalAlerts', value)}
          />
          <Field
            label="Past Dental History (PDH)"
            value={form.pastDentalHistory}
            onChange={(value) => update('pastDentalHistory', value)}
          />
          <Field
            label="Social and Family History"
            value={form.socialFamilyHistory}
            onChange={(value) => update('socialFamilyHistory', value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2 Clinical Examination</CardTitle>
          <CardDescription>
            Objective findings, measurements, tooth conditions and radiographs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Blood Pressure</Label>
              <Input
                value={form.bloodPressure}
                onChange={(event) => update('bloodPressure', event.target.value)}
                placeholder="128/82 mmHg"
              />
            </div>
            <div className="space-y-2">
              <Label>Heart Rate</Label>
              <Input
                value={form.heartRate}
                onChange={(event) => update('heartRate', event.target.value)}
                placeholder="74 bpm"
              />
            </div>
            <div className="space-y-2">
              <Label>Temperature</Label>
              <Input
                value={form.temperature}
                onChange={(event) => update('temperature', event.target.value)}
                placeholder="36.9 °C"
              />
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Field
              label="Facial Symmetry and Extra-Oral Exam"
              value={form.extraOralExam}
              onChange={(value) => update('extraOralExam', value)}
            />
            <Field
              label="Intra-Oral Exam"
              value={form.intraOralExam}
              onChange={(value) => update('intraOralExam', value)}
            />
          </div>
          <DentalChart patientId={id} />
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <Field
              label="X-Ray / Radiograph Findings"
              value={form.radiographNotes}
              onChange={(value) => update('radiographNotes', value)}
              rows={5}
            />
            <div className="space-y-3 rounded-xl border p-4">
              <Label>Upload Radiograph</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              />
              <Input
                value={uploadDescription}
                onChange={(event) => setUploadDescription(event.target.value)}
                placeholder="View and finding description"
              />
              <Button
                type="button"
                variant="outline"
                onClick={uploadRadiograph}
                disabled={!uploadFile || uploading}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload
              </Button>
            </div>
          </div>
          {data.radiographs.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.radiographs.map((document) => (
                <a
                  key={document.id}
                  href={`/api/uploads/${document.filePath}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl border p-3 text-sm hover:border-primary"
                >
                  <FileImage className="h-5 w-5 text-primary" />
                  <span className="min-w-0">
                    <strong className="block truncate">{document.originalName}</strong>
                    <span className="text-muted-foreground">
                      {document.description || 'No note'}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3 Diagnosis</CardTitle>
        </CardHeader>
        <CardContent>
          <Field
            label="Diagnosis / Assessment *"
            value={form.diagnosis}
            onChange={(value) => update('diagnosis', value)}
            placeholder="Connect diagnosis to tooth or area"
            rows={5}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4 Treatment Plan and Consent</CardTitle>
          <CardDescription>
            Group proposed work by phase. Record estimate before consent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field
            label="Proposed Phased Plan"
            value={form.treatmentPlan}
            onChange={(value) => update('treatmentPlan', value)}
            placeholder={
              'Phase 1: Emergency care\nPhase 2: Restorative care\nPhase 3: Preventive care'
            }
            rows={7}
          />
          <div className="space-y-2">
            <Label>Cost Estimate</Label>
            <Input
              value={form.estimatedCost}
              onChange={(event) => update('estimatedCost', event.target.value)}
              placeholder="ETB 12,500"
            />
          </div>
          <div className="space-y-2">
            <Label>Patient Consent Name</Label>
            <Input
              value={form.patientConsentName}
              onChange={(event) => update('patientConsentName', event.target.value)}
            />
          </div>
          <div className="overflow-x-auto">
            <SignaturePad
              width={500}
              height={160}
              onSignatureChange={setSignature}
              label="I approve the proposed treatment plan and cost estimate"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5 Treatment Done and Progress Notes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-2">
          <Field
            label="Completed Procedures"
            value={form.completedProcedures}
            onChange={(value) => update('completedProcedures', value)}
          />
          <Field
            label="Materials and Anesthesia Used"
            value={form.materialsAnesthesia}
            onChange={(value) => update('materialsAnesthesia', value)}
          />
          <Field
            label="Post-Op Instructions"
            value={form.postOpInstructions}
            onChange={(value) => update('postOpInstructions', value)}
          />
          <Field
            label="Next Visit"
            value={form.nextVisit}
            onChange={(value) => update('nextVisit', value)}
            placeholder="Date and planned procedure"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Previous Clinical Charts</CardTitle>
          <CardDescription>Saved encounters are immutable permanent records.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.charts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved clinical charts.</p>
          ) : (
            <div className="divide-y">
              {data.charts.map((chart) => (
                <div
                  key={chart.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium">{chart.data.chartNo}</p>
                    <p className="text-sm text-muted-foreground">
                      {chart.data.diagnosis} · {new Date(chart.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={`/api/patients/${id}/clinical-chart/${chart.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
