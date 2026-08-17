'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Download, FileText, Loader2, Save, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { ErpModuleOverview } from '@/components/dashboard/erp-overview'
import { formatCurrency, formatDate } from '@/lib/i18n/format'

type MedicalHistoryForm = {
  hasAllergies: boolean
  drugAllergies: string
  foodAllergies: string
  materialAllergies: string
  hasDiabetes: boolean
  diabetesType: string
  hasHypertension: boolean
  hasHeartDisease: boolean
  heartCondition: string
  hasBleedingDisorder: boolean
  hasAsthma: boolean
  hasThyroid: boolean
  thyroidType: string
  hasHepatitis: boolean
  hepatitisType: string
  hasHiv: boolean
  hasEpilepsy: boolean
  isPregnant: boolean
  pregnancyWeeks: string
  otherConditions: string
  currentMedications: string
  previousDentalWork: string
  lastDentalVisit: string
  dentalAnxietyLevel: string
  familyDentalHistory: string
  smokingStatus: string
  alcoholConsumption: string
  tobaccoChewing: boolean
  additionalNotes: string
}

type PatientHistoryResponse = {
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
    phone: string
    email: string | null
    gender: string | null
    dateOfBirth: string | null
    createdAt: string
    medicalHistory: Partial<MedicalHistoryForm> | null
    treatments: Array<{
      id: string
      treatmentNo: string
      createdAt: string
      status: string
      diagnosis: string | null
      findings: string | null
      procedureNotes: string | null
      toothNumbers: string | null
      followUpRequired: boolean
      followUpDate: string | null
      cost: number | string
      procedure: { name: string; category: string }
      doctor: { id: string; firstName: string; lastName: string }
    }>
    documents: Array<{
      id: string
      originalName: string
      documentType: string
      description: string | null
      fileType: string
      fileSize: number
      createdAt: string
      treatmentId: string | null
    }>
    _count: {
      treatments: number
      documents: number
      appointments: number
    }
  }
}

const defaultForm: MedicalHistoryForm = {
  hasAllergies: false,
  drugAllergies: '',
  foodAllergies: '',
  materialAllergies: '',
  hasDiabetes: false,
  diabetesType: '',
  hasHypertension: false,
  hasHeartDisease: false,
  heartCondition: '',
  hasBleedingDisorder: false,
  hasAsthma: false,
  hasThyroid: false,
  thyroidType: '',
  hasHepatitis: false,
  hepatitisType: '',
  hasHiv: false,
  hasEpilepsy: false,
  isPregnant: false,
  pregnancyWeeks: '',
  otherConditions: '',
  currentMedications: '',
  previousDentalWork: '',
  lastDentalVisit: '',
  dentalAnxietyLevel: '',
  familyDentalHistory: '',
  smokingStatus: 'NEVER',
  alcoholConsumption: 'NEVER',
  tobaccoChewing: false,
  additionalNotes: '',
}

const documentTypes = [
  'XRAY',
  'CT_SCAN',
  'PHOTO',
  'CONSENT_FORM',
  'PRESCRIPTION',
  'LAB_REPORT',
  'INSURANCE',
  'ID_PROOF',
  'OTHER',
]

export default function PatientMedicalHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [patient, setPatient] = useState<PatientHistoryResponse['patient'] | null>(null)
  const [form, setForm] = useState<MedicalHistoryForm>(defaultForm)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadType, setUploadType] = useState('XRAY')
  const [uploadDescription, setUploadDescription] = useState('')

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/patients/${id}/medical-history`)
      if (!response.ok) throw new Error('Failed to load medical history')
      const data = (await response.json()) as PatientHistoryResponse
      setPatient(data.patient)
      setForm({
        ...defaultForm,
        ...data.patient.medicalHistory,
        pregnancyWeeks: data.patient.medicalHistory?.pregnancyWeeks?.toString() || '',
        dentalAnxietyLevel: data.patient.medicalHistory?.dentalAnxietyLevel?.toString() || '',
        lastDentalVisit: data.patient.medicalHistory?.lastDentalVisit
          ? String(data.patient.medicalHistory.lastDentalVisit).split('T')[0]
          : '',
      })
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to load patient history',
        description: error.message,
      })
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchHistory()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchHistory])

  const updateField = <K extends keyof MedicalHistoryForm>(key: K, value: MedicalHistoryForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await fetch(`/api/patients/${id}/medical-history`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save medical history')
      }

      toast({ title: 'Medical history updated' })
      void fetchHistory()
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: error.message,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async () => {
    if (!uploadFile) {
      toast({ variant: 'destructive', title: 'Select a file to upload' })
      return
    }

    try {
      setUploading(true)
      const payload = new FormData()
      payload.append('file', uploadFile)
      payload.append('documentType', uploadType)
      if (uploadDescription) payload.append('description', uploadDescription)

      const response = await fetch(`/api/patients/${id}/documents`, {
        method: 'POST',
        body: payload,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload document')
      }

      toast({ title: 'Document uploaded' })
      setUploadFile(null)
      setUploadDescription('')
      const fileInput = document.getElementById('patient-record-upload') as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
      fetchHistory()
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error.message,
      })
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
          <Skeleton className="h-[640px]" />
          <Skeleton className="h-[640px]" />
        </div>
      </div>
    )
  }

  if (!patient) {
    return <div className="text-sm text-muted-foreground">Patient not found.</div>
  }

  return (
    <div className="space-y-6">
      <ErpModuleOverview
        moduleId="patients"
        eyebrow="Medical history ERP"
        title="Medical history, prior treatment, and evidence in one patient record"
        description="Allergy flags, systemic conditions, past procedures, uploaded records, and follow-up context stay attached to the same patient chart."
        compact
        showActions={false}
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            href={`/patients/${id}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to patient
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Medical & dental history
          </h1>
          <p className="text-muted-foreground">
            {patient.firstName} {patient.lastName} ({patient.patientId})
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save history
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Medical history</CardTitle>
              <CardDescription>
                Persistent clinical history used during assessments, diagnosis, and treatment planning.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ['hasAllergies', 'Allergies'],
                  ['hasDiabetes', 'Diabetes'],
                  ['hasHypertension', 'Hypertension'],
                  ['hasHeartDisease', 'Heart disease'],
                  ['hasBleedingDisorder', 'Bleeding disorder'],
                  ['hasAsthma', 'Asthma'],
                  ['hasThyroid', 'Thyroid condition'],
                  ['hasHepatitis', 'Hepatitis'],
                  ['hasHiv', 'HIV'],
                  ['hasEpilepsy', 'Epilepsy'],
                  ['isPregnant', 'Pregnant'],
                  ['tobaccoChewing', 'Tobacco chewing'],
                ].map(([field, label]) => (
                  <label key={field} className="flex items-center gap-3 rounded-lg border p-3">
                    <Checkbox
                      checked={Boolean(form[field as keyof MedicalHistoryForm])}
                      onCheckedChange={(checked) =>
                        updateField(field as keyof MedicalHistoryForm, Boolean(checked) as never)
                      }
                    />
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Drug allergies</Label>
                  <Textarea
                    value={form.drugAllergies}
                    onChange={(event) => updateField('drugAllergies', event.target.value)}
                    placeholder="Penicillin, NSAIDs, latex-related medicines..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Food allergies</Label>
                  <Textarea
                    value={form.foodAllergies}
                    onChange={(event) => updateField('foodAllergies', event.target.value)}
                    placeholder="Peanuts, dairy, shellfish..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Material allergies</Label>
                  <Textarea
                    value={form.materialAllergies}
                    onChange={(event) => updateField('materialAllergies', event.target.value)}
                    placeholder="Acrylic, nickel, impression materials..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Current medications</Label>
                  <Textarea
                    value={form.currentMedications}
                    onChange={(event) => updateField('currentMedications', event.target.value)}
                    placeholder="Active prescriptions, supplements, dosage..."
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Diabetes type</Label>
                  <Input
                    value={form.diabetesType}
                    onChange={(event) => updateField('diabetesType', event.target.value)}
                    placeholder="Type 1 / Type 2"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Heart condition</Label>
                  <Input
                    value={form.heartCondition}
                    onChange={(event) => updateField('heartCondition', event.target.value)}
                    placeholder="Arrhythmia, valve issue..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Thyroid type</Label>
                  <Input
                    value={form.thyroidType}
                    onChange={(event) => updateField('thyroidType', event.target.value)}
                    placeholder="Hypo / hyperthyroid"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hepatitis type</Label>
                  <Input
                    value={form.hepatitisType}
                    onChange={(event) => updateField('hepatitisType', event.target.value)}
                    placeholder="A, B, C..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pregnancy weeks</Label>
                  <Input
                    type="number"
                    value={form.pregnancyWeeks}
                    onChange={(event) => updateField('pregnancyWeeks', event.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dental anxiety level</Label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    value={form.dentalAnxietyLevel}
                    onChange={(event) => updateField('dentalAnxietyLevel', event.target.value)}
                    placeholder="0-10"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Smoking status</Label>
                  <Select
                    value={form.smokingStatus}
                    onValueChange={(value) => updateField('smokingStatus', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEVER">Never</SelectItem>
                      <SelectItem value="FORMER">Former</SelectItem>
                      <SelectItem value="OCCASIONAL">Occasional</SelectItem>
                      <SelectItem value="CURRENT">Current</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Alcohol consumption</Label>
                  <Select
                    value={form.alcoholConsumption}
                    onValueChange={(value) => updateField('alcoholConsumption', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEVER">Never</SelectItem>
                      <SelectItem value="OCCASIONAL">Occasional</SelectItem>
                      <SelectItem value="MODERATE">Moderate</SelectItem>
                      <SelectItem value="HEAVY">Heavy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Previous dental work</Label>
                  <Textarea
                    value={form.previousDentalWork}
                    onChange={(event) => updateField('previousDentalWork', event.target.value)}
                    placeholder="Root canals, implants, crowns, orthodontic work..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last dental visit</Label>
                  <Input
                    type="date"
                    value={form.lastDentalVisit}
                    onChange={(event) => updateField('lastDentalVisit', event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Family dental history</Label>
                  <Textarea
                    value={form.familyDentalHistory}
                    onChange={(event) => updateField('familyDentalHistory', event.target.value)}
                    placeholder="Periodontal disease, malocclusion, caries risk..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Other medical conditions</Label>
                  <Textarea
                    value={form.otherConditions}
                    onChange={(event) => updateField('otherConditions', event.target.value)}
                    placeholder="Autoimmune disorders, surgeries, hospitalizations..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Additional notes</Label>
                  <Textarea
                    value={form.additionalNotes}
                    onChange={(event) => updateField('additionalNotes', event.target.value)}
                    placeholder="Chairside instructions, prophylaxis risks, anesthesia notes..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Previous treatments</CardTitle>
              <CardDescription>
                Completed and in-flight procedures for historical review and follow-up planning.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Treatment</TableHead>
                    <TableHead>Procedure</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patient.treatments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No treatment history recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    patient.treatments.map((treatment) => (
                      <TableRow key={treatment.id}>
                        <TableCell>
                          <div className="font-medium">{treatment.treatmentNo}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(treatment.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{treatment.procedure.name}</div>
                          <Badge variant="outline" className="mt-1">
                            {treatment.procedure.category.replaceAll('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <div className="line-clamp-2 text-sm">
                            {treatment.diagnosis || treatment.findings || 'No diagnosis recorded'}
                          </div>
                        </TableCell>
                        <TableCell>
                          Dr. {treatment.doctor.firstName} {treatment.doctor.lastName}
                        </TableCell>
                        <TableCell>
                          {treatment.followUpRequired ? (
                            <span>{treatment.followUpDate ? formatDate(treatment.followUpDate) : 'Required'}</span>
                          ) : (
                            <span className="text-muted-foreground">Not required</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(treatment.cost)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Patient summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">Appointments</div>
                <div className="mt-1 text-2xl font-semibold">{patient._count.appointments}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">Treatments</div>
                <div className="mt-1 text-2xl font-semibold">{patient._count.treatments}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">Records</div>
                <div className="mt-1 text-2xl font-semibold">{patient._count.documents}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Patient records</CardTitle>
              <CardDescription>Upload radiographs, consent forms, reports, photos, and supporting records.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="patient-record-upload">Upload file</Label>
                <Input
                  id="patient-record-upload"
                  type="file"
                  onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Document type</Label>
                <Select value={uploadType} onValueChange={setUploadType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value.replaceAll('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={uploadDescription}
                  onChange={(event) => setUploadDescription(event.target.value)}
                  placeholder="Clinical note or context for this record..."
                />
              </div>
              <Button onClick={handleUpload} disabled={uploading} className="w-full">
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload record
              </Button>

              <Separator />

              <div className="space-y-3">
                {patient.documents.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No patient records uploaded yet.
                  </div>
                ) : (
                  patient.documents.map((document) => (
                    <div
                      key={document.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <p className="truncate font-medium">{document.originalName}</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {document.documentType.replaceAll('_', ' ')} · {formatDate(document.createdAt)} ·{' '}
                          {Math.max(1, Math.round(document.fileSize / 1024))} KB
                        </p>
                        {document.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{document.description}</p>
                        )}
                      </div>
                      <a
                        href={`/api/patients/${patient.id}/documents/${document.id}?download=true`}
                        className="inline-flex"
                      >
                        <Button variant="outline" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
