'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function EditTreatmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('Treatment')
  const [form, setForm] = useState({
    chiefComplaint: '',
    diagnosis: '',
    findings: '',
    procedureNotes: '',
    materialsUsed: '',
    complications: '',
    toothNumbers: '',
    cost: '',
    followUpRequired: false,
    followUpDate: '',
  })

  useEffect(() => {
    fetch(`/api/treatments/${id}`)
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Failed to load treatment')
        setTitle(result.treatmentNo)
        setForm({
          chiefComplaint: result.chiefComplaint || '',
          diagnosis: result.diagnosis || '',
          findings: result.findings || '',
          procedureNotes: result.procedureNotes || '',
          materialsUsed: result.materialsUsed || '',
          complications: result.complications || '',
          toothNumbers: result.toothNumbers || '',
          cost: String(result.cost ?? ''),
          followUpRequired: Boolean(result.followUpRequired),
          followUpDate: result.followUpDate ? result.followUpDate.slice(0, 10) : '',
        })
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'Failed to load treatment')
      )
      .finally(() => setLoading(false))
  }, [id])

  const set = (field: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [field]: value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/treatments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, cost: Number(form.cost) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to update treatment')
      window.location.assign(`/treatments/${id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to update treatment')
      setSaving(false)
    }
  }

  if (loading) return <div className="h-80 animate-pulse rounded-2xl bg-white" />

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/treatments/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit {title}</h1>
          <p className="text-muted-foreground">
            Correct clinical details and follow-up information.
          </p>
        </div>
      </div>
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <form onSubmit={submit} className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Clinical record</CardTitle>
            <CardDescription>Keep corrections clear and clinically accurate.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <Field label="Chief complaint">
              <Textarea
                value={form.chiefComplaint}
                onChange={(event) => set('chiefComplaint', event.target.value)}
              />
            </Field>
            <Field label="Diagnosis">
              <Textarea
                value={form.diagnosis}
                onChange={(event) => set('diagnosis', event.target.value)}
              />
            </Field>
            <Field label="Findings">
              <Textarea
                value={form.findings}
                onChange={(event) => set('findings', event.target.value)}
              />
            </Field>
            <Field label="Procedure notes">
              <Textarea
                value={form.procedureNotes}
                onChange={(event) => set('procedureNotes', event.target.value)}
              />
            </Field>
            <Field label="Materials used">
              <Textarea
                value={form.materialsUsed}
                onChange={(event) => set('materialsUsed', event.target.value)}
              />
            </Field>
            <Field label="Complications">
              <Textarea
                value={form.complications}
                onChange={(event) => set('complications', event.target.value)}
              />
            </Field>
            <Field label="FDI tooth numbers">
              <Input
                value={form.toothNumbers}
                onChange={(event) => set('toothNumbers', event.target.value)}
                placeholder="11,12,21"
              />
            </Field>
            <Field label="Treatment cost (ETB)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.cost}
                onChange={(event) => set('cost', event.target.value)}
              />
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Follow-up</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <label className="flex items-center gap-3">
              <Checkbox
                checked={form.followUpRequired}
                onCheckedChange={(checked) => set('followUpRequired', checked === true)}
              />{' '}
              Follow-up required
            </label>
            <Field label="Follow-up date">
              <Input
                type="date"
                disabled={!form.followUpRequired}
                value={form.followUpDate}
                onChange={(event) => set('followUpDate', event.target.value)}
              />
            </Field>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Link href={`/treatments/${id}`}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save changes
          </Button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
