'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SaaSAccess } from '@/lib/saas/catalog'

type Note = { id: string; author: string; body: string; createdAt: string }

export function ClinicProfile({
  clinic,
  busy,
  save,
}: {
  clinic: SaaSAccess
  busy: boolean
  save: (profile: { name: string; planName: string; monthlyFee: string }) => Promise<unknown>
}) {
  const [name, setName] = useState(clinic.name)
  const [planName, setPlanName] = useState(clinic.planName)
  const [fee, setFee] = useState(clinic.monthlyFee)
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState('')
  const [noteError, setNoteError] = useState('')

  const loadNotes = useCallback(async () => {
    const response = await fetch(`/api/saas-admin/tenants/${clinic.tenantId}/notes`, {
      cache: 'no-store',
    })
    if (response.ok) setNotes((await response.json()).notes)
  }, [clinic.tenantId])

  useEffect(() => {
    void loadNotes()
  }, [loadNotes])

  async function addNote() {
    setNoteError('')
    const response = await fetch(`/api/saas-admin/tenants/${clinic.tenantId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: draft }),
    })
    if (!response.ok) return setNoteError('Could not save the note.')
    setDraft('')
    await loadNotes()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile and internal notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault()
            void save({ name, planName, monthlyFee: fee })
          }}
        >
          <label className="text-sm">
            Clinic name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              required
              className="mt-1 block h-10 w-full rounded-md border border-input px-3"
            />
          </label>
          <label className="text-sm">
            Plan name
            <input
              value={planName}
              onChange={(event) => setPlanName(event.target.value)}
              required
              className="mt-1 block h-10 w-full rounded-md border border-input px-3"
            />
          </label>
          <label className="text-sm">
            Monthly fee ({clinic.currency})
            <input
              value={fee}
              onChange={(event) => setFee(event.target.value)}
              type="number"
              min="0"
              step="0.01"
              required
              className="mt-1 block h-10 w-full rounded-md border border-input px-3"
            />
          </label>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={busy}>
              Save profile
            </Button>
          </div>
        </form>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Internal notes (never shown to the clinic)</h3>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Call log, agreement, reminder…"
              aria-label="New internal note"
              className="h-10 flex-1 rounded-md border border-input px-3 text-sm"
            />
            <Button type="button" variant="outline" disabled={!draft.trim()} onClick={addNote}>
              Add note
            </Button>
          </div>
          {noteError && <p className="mt-2 text-sm text-red-700">{noteError}</p>}
          <ul className="mt-3 space-y-2 text-sm">
            {notes.map((note) => (
              <li key={note.id} className="rounded border p-2">
                {note.body}
                <div className="mt-1 text-xs text-slate-500">
                  {note.author} · {new Date(note.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
            {notes.length === 0 && <li className="text-slate-500">No notes yet.</li>}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
