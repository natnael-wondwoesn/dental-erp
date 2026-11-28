'use client'

import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface AssessmentRecord {
  id: string
  vitalSign: string | null
  assessment: string | null
  createdAt: string
  doctor?: { firstName: string; lastName: string } | null
}

function when(value: string) {
  const d = new Date(value)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * The whole assessment capture for a visit: two free-text boxes. Every save adds a
 * new dated record under the same patient; earlier records are kept and viewable.
 */
export function BtfanaAssessmentCard({
  patientId,
  patientName,
}: {
  patientId: string
  patientName: string
}) {
  const [records, setRecords] = useState<AssessmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [doctorName, setDoctorName] = useState('')
  const [canWrite, setCanWrite] = useState(false)
  const [vitalSign, setVitalSign] = useState('')
  const [assessment, setAssessment] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

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
      .then((me) => {
        setDoctorName(me?.name ?? '')
        setCanWrite(
          Array.isArray(me?.roles) && me.roles.some((r: string) => ['ADMIN', 'DOCTOR'].includes(r))
        )
      })
      .catch(() => setCanWrite(false))
  }, [load])

  const canSave = !busy && (vitalSign.trim() !== '' || assessment.trim() !== '')

  async function save() {
    if (!canSave) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/patients/${patientId}/assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vitalSign, assessment }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save the assessment')
      setVitalSign('')
      setAssessment('')
      setMessage({ tone: 'ok', text: 'Assessment saved.' })
      await load()
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Could not save the assessment',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-[22px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_rgba(28,55,90,.06)] sm:p-7">
      <h2 className="flex items-center gap-2 font-semibold">
        <ClipboardList className="h-4 w-4 text-[#086be6]" /> Assessment
      </h2>

      {canWrite && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-500">
            Patient: <span className="font-medium text-slate-800">{patientName}</span>
            {doctorName && (
              <>
                {' · '}Doctor: <span className="font-medium text-slate-800">{doctorName}</span>
              </>
            )}
          </p>

          <div>
            <Label htmlFor="assessment-vital">Vital Sign</Label>
            <Textarea
              id="assessment-vital"
              rows={3}
              value={vitalSign}
              onChange={(e) => setVitalSign(e.target.value)}
              placeholder="e.g. BP 120/80, pulse 72, temperature 36.6"
            />
          </div>

          <div>
            <Label htmlFor="assessment-text">Assessment</Label>
            <Textarea
              id="assessment-text"
              rows={6}
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              placeholder="Clinical assessment for today's visit"
            />
          </div>

          {message && (
            <p
              role="status"
              className={`rounded-xl p-3 text-sm ${message.tone === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
            >
              {message.text}
            </p>
          )}

          <Button onClick={save} disabled={!canSave} className="w-full sm:w-auto">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Assessment'}
          </Button>
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-700">Assessment history</h3>
        {loading ? (
          <p className="mt-3 text-sm text-slate-400">Loading…</p>
        ) : records.length === 0 ? (
          <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-400">
            No assessments recorded yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {records.map((r) => {
              const open = openId === r.id
              return (
                <li key={r.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{when(r.createdAt)}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {r.doctor ? `Dr. ${r.doctor.firstName} ${r.doctor.lastName}` : '-'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOpenId(open ? null : r.id)}
                      aria-expanded={open}
                    >
                      {open ? 'Hide' : 'View'}
                    </Button>
                  </div>
                  {open && (
                    <dl className="mt-3 space-y-3 text-sm">
                      <div>
                        <dt className="text-xs font-semibold uppercase text-slate-400">
                          Vital Sign
                        </dt>
                        <dd className="whitespace-pre-wrap">{r.vitalSign || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase text-slate-400">
                          Assessment
                        </dt>
                        <dd className="whitespace-pre-wrap">{r.assessment || '-'}</dd>
                      </div>
                    </dl>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
