'use client'

import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface TreatmentRecord {
  id: string
  vitalSigns: string | null
  others: string | null
  createdAt: string
  doctor?: { firstName: string; lastName: string } | null
}

function when(value: string) {
  const d = new Date(value)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function preview(r: TreatmentRecord) {
  const text = (r.vitalSigns || r.others || '').replace(/\s+/g, ' ')
  return text.length > 70 ? `${text.slice(0, 70)}…` : text
}

/**
 * Treatment notes for a patient: a "New treatment" button opens a pop-up with two
 * multi-line boxes (Vital signs, Others). Every save is a new dated, read-only record,
 * listed newest first; clicking one opens it in a pop-up.
 */
export function BtfanaTreatmentsCard({ patientId }: { patientId: string }) {
  const [records, setRecords] = useState<TreatmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [canWrite, setCanWrite] = useState(false)
  const [creating, setCreating] = useState(false)
  const [vitalSigns, setVitalSigns] = useState('')
  const [others, setOthers] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [viewing, setViewing] = useState<TreatmentRecord | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}/assessments`, { cache: 'no-store' })
      const data = await res.json()
      setRecords(res.ok ? (data.assessments ?? []) : [])
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    void load()
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((me) =>
        setCanWrite(
          Array.isArray(me?.roles) && me.roles.some((r: string) => ['ADMIN', 'DOCTOR'].includes(r))
        )
      )
      .catch(() => setCanWrite(false))
  }, [load])

  function openNew() {
    // Every new treatment starts with blank boxes.
    setVitalSigns('')
    setOthers('')
    setError('')
    setCreating(true)
  }

  const canSave = !busy && (vitalSigns.trim() !== '' || others.trim() !== '')

  async function save() {
    if (!canSave) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/patients/${patientId}/assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vitalSigns, others }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save the treatment')
      setCreating(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the treatment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-[22px] border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgba(28,55,90,.06)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <ClipboardList className="h-4 w-4 text-[#086be6]" /> Treatments
        </h2>
        {canWrite && (
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> New treatment
          </Button>
        )}
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : records.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-400">
            No treatments recorded yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {records.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setViewing(r)}
                  className="w-full rounded-xl border border-slate-100 p-3 text-left transition hover:border-[#086be6] hover:bg-slate-50"
                >
                  <span className="block text-sm font-semibold">{when(r.createdAt)}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {r.doctor ? `Dr. ${r.doctor.firstName} ${r.doctor.lastName}` : '-'}
                  </span>
                  {preview(r) && (
                    <span className="mt-1 block truncate text-sm text-slate-600">{preview(r)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={creating} onOpenChange={(open) => !busy && setCreating(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New treatment</DialogTitle>
            <DialogDescription>
              Saved treatments cannot be edited afterwards, so check the notes before saving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="treatment-vital-signs">Vital signs</Label>
              <Textarea
                id="treatment-vital-signs"
                rows={4}
                value={vitalSigns}
                onChange={(e) => setVitalSigns(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="treatment-others">Others</Label>
              <Textarea
                id="treatment-others"
                rows={7}
                value={others}
                onChange={(e) => setOthers(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!canSave}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save treatment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Treatment</DialogTitle>
            <DialogDescription>
              {viewing ? when(viewing.createdAt) : ''}
              {viewing?.doctor
                ? ` · Dr. ${viewing.doctor.firstName} ${viewing.doctor.lastName}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Vital signs</dt>
                <dd className="mt-1 whitespace-pre-wrap">{viewing.vitalSigns || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">Others</dt>
                <dd className="mt-1 whitespace-pre-wrap">{viewing.others || '-'}</dd>
              </div>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
