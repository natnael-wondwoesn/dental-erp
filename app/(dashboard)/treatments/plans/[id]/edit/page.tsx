'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function EditTreatmentPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    notes: '',
    startDate: '',
    expectedEndDate: '',
    consentGiven: false,
  })

  useEffect(() => {
    fetch(`/api/treatment-plans/${id}`)
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Failed to load treatment plan')
        setForm({
          title: result.title || '',
          notes: result.notes || '',
          startDate: result.startDate ? result.startDate.slice(0, 10) : '',
          expectedEndDate: result.expectedEndDate ? result.expectedEndDate.slice(0, 10) : '',
          consentGiven: Boolean(result.consentGiven),
        })
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'Failed to load treatment plan')
      )
      .finally(() => setLoading(false))
  }, [id])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/treatment-plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to update treatment plan')
      window.location.assign(`/treatments/plans/${id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to update treatment plan')
      setSaving(false)
    }
  }

  if (loading) return <div className="h-72 animate-pulse rounded-2xl bg-white" />

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/treatments/plans/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit treatment plan</h1>
          <p className="text-muted-foreground">Update plan timing, notes, and consent.</p>
        </div>
      </div>
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <form onSubmit={submit}>
        <Card>
          <CardHeader>
            <CardTitle>Plan details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                required
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={5}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Expected end date</Label>
                <Input
                  type="date"
                  min={form.startDate}
                  value={form.expectedEndDate}
                  onChange={(event) => setForm({ ...form, expectedEndDate: event.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-3">
              <Checkbox
                checked={form.consentGiven}
                onCheckedChange={(checked) => setForm({ ...form, consentGiven: checked === true })}
              />{' '}
              Patient consent recorded
            </label>
            <div className="flex justify-end gap-2">
              <Link href={`/treatments/plans/${id}`}>
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
                Save plan
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
