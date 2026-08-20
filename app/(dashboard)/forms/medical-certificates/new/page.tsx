'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileHeart, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface PatientOption {
  id: string
  patientId: string
  firstName: string
  lastName: string
  email: string | null
  phone: string
  city: string | null
}

export default function NewMedicalCertificatePage() {
  const router = useRouter()
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [loadingPatients, setLoadingPatients] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    patientId: '',
    examinedAt: today,
    dentalDiagnosis: '',
    medicalDiagnosis: '',
    recommendation: '',
    city: '',
    subCity: '',
    woreda: '',
    leaveFrom: '',
    leaveTo: '',
  })

  useEffect(() => {
    fetch('/api/patients?all=true')
      .then((response) => response.json())
      .then((result) => setPatients(result.patients || []))
      .catch(() => toast.error('Failed to load patients'))
      .finally(() => setLoadingPatients(false))
  }, [])

  const selectedPatient = patients.find((patient) => patient.id === form.patientId)
  const set = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.patientId || !form.dentalDiagnosis.trim() || !form.recommendation.trim()) {
      toast.error('Patient, dental diagnosis and recommendation are required')
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/clinical-forms/medical-certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to create certificate')
      toast.success('Medical certificate prepared')
      router.push(`/forms/medical-certificates/${result.certificate.id}`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to create certificate')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <Button variant="ghost" onClick={() => router.push('/forms/medical-certificates')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to certificates
      </Button>
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <FileHeart className="h-8 w-8 text-primary" /> Prepare medical certificate
        </h1>
        <p className="mt-2 text-muted-foreground">
          Patient details and doctor credentials are added automatically.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Patient and examination</CardTitle>
            <CardDescription>
              Select the patient record this certificate belongs to.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Patient *</Label>
              <Select
                value={form.patientId}
                onValueChange={(value) => {
                  const patient = patients.find((item) => item.id === value)
                  setForm((current) => ({
                    ...current,
                    patientId: value,
                    city: current.city || patient?.city || '',
                  }))
                }}
                disabled={loadingPatients}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={loadingPatients ? 'Loading patients…' : 'Select patient'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.firstName} {patient.lastName} · {patient.patientId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPatient && (
                <p className="text-xs text-muted-foreground">
                  {selectedPatient.email || 'No email on record'} · {selectedPatient.phone}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="examinedAt">Date examined and treated *</Label>
              <Input
                id="examinedAt"
                type="date"
                value={form.examinedAt}
                onChange={(event) => set('examinedAt', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(event) => set('city', event.target.value)}
                placeholder="Addis Ababa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subCity">Sub City</Label>
              <Input
                id="subCity"
                value={form.subCity}
                onChange={(event) => set('subCity', event.target.value)}
                placeholder="Bole"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="woreda">Woreda</Label>
              <Input
                id="woreda"
                value={form.woreda}
                onChange={(event) => set('woreda', event.target.value)}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Clinical statement</CardTitle>
            <CardDescription>
              Use clear clinical language suitable for an employer, school or insurer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="dentalDiagnosis">Dental diagnosis *</Label>
              <Textarea
                id="dentalDiagnosis"
                rows={3}
                value={form.dentalDiagnosis}
                onChange={(event) => set('dentalDiagnosis', event.target.value)}
                placeholder="Clinical dental diagnosis and treatment performed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="medicalDiagnosis">Medical diagnosis</Label>
              <Textarea
                id="medicalDiagnosis"
                rows={3}
                value={form.medicalDiagnosis}
                onChange={(event) => set('medicalDiagnosis', event.target.value)}
                placeholder="Relevant medical diagnosis, if any"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recommendation">Recommendation *</Label>
              <Textarea
                id="recommendation"
                rows={4}
                value={form.recommendation}
                onChange={(event) => set('recommendation', event.target.value)}
                placeholder="Rest, medication, follow-up and work/school recommendations"
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leaveFrom">Medical leave from</Label>
                <Input
                  id="leaveFrom"
                  type="date"
                  value={form.leaveFrom}
                  onChange={(event) => set('leaveFrom', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leaveTo">Return / leave through</Label>
                <Input
                  id="leaveTo"
                  type="date"
                  min={form.leaveFrom}
                  value={form.leaveTo}
                  onChange={(event) => set('leaveTo', event.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/forms/medical-certificates')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Prepare certificate
          </Button>
        </div>
      </form>
    </div>
  )
}
