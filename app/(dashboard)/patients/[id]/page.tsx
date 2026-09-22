'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  ArrowLeft,
  CalendarDays,
  Download,
  Edit3,
  FileText,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Upload,
  BellRing,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { getCurrentUser } from '@/lib/api-client'

type Patient = {
  id: string
  patientId: string
  firstName: string
  lastName: string
  email?: string | null
  phone: string
  dateOfBirth?: string | null
  age?: number | null
  gender?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  createdAt?: string
  appointments?: Array<{
    id: string
    scheduledDate: string
    scheduledTime?: string
    status?: string
    appointmentType?: string
    duration?: number
    doctor?: { firstName: string; lastName: string } | null
  }>
  documents?: Array<{ id: string; originalName?: string; fileName?: string; fileSize?: number }>
  _count?: { appointments?: number; treatments?: number; documents?: number }
}

type PatientRecall = {
  id: string
  lastTreatmentDate: string
  followUpDate: string
  reminderDate: string
  reminderLeadDays: number
  status: 'SCHEDULED' | 'REMINDER_SENT' | 'RETURNED' | 'CANCELLED'
  smsStatus: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED'
  smsSentAt?: string | null
  returnedAt?: string | null
}

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { t } = useLanguage()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [tab, setTab] = useState<'upcoming' | 'past' | 'records'>('upcoming')
  const [recalls, setRecalls] = useState<PatientRecall[]>([])
  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [recallBusy, setRecallBusy] = useState(false)
  const [recallMessage, setRecallMessage] = useState('')

  const loadRecalls = useCallback(
    () =>
      fetch(`/api/patients/${id}/recalls`)
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .then((data) => setRecalls(data.recalls || []))
        .catch(() => setRecalls([])),
    [id]
  )

  useEffect(() => {
    fetch(`/api/patients/${id}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setPatient(data.patient))
      .catch(() => setLoadError(true))
    void loadRecalls()
    getCurrentUser().then((user) => setCurrentRole(user?.roles[0] || null))
  }, [id, loadRecalls])

  const scheduleRecall = async () => {
    setRecallBusy(true)
    setRecallMessage('')
    try {
      const response = await fetch(`/api/patients/${id}/recalls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpMonths: 6, reminderLeadDays: 7 }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to schedule recall')
      setRecallMessage('Six-month recall scheduled.')
      await loadRecalls()
    } catch (error) {
      setRecallMessage(error instanceof Error ? error.message : 'Unable to schedule recall')
    } finally {
      setRecallBusy(false)
    }
  }

  const markRecallReturned = async (recallId: string) => {
    setRecallBusy(true)
    setRecallMessage('')
    try {
      const response = await fetch(`/api/patients/${id}/recalls/${recallId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RETURNED' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to update recall')
      setRecallMessage('Patient return recorded.')
      await loadRecalls()
    } catch (error) {
      setRecallMessage(error instanceof Error ? error.message : 'Unable to update recall')
    } finally {
      setRecallBusy(false)
    }
  }

  if (loadError) {
    return <p className="p-6 text-sm text-destructive">Unable to load this patient record.</p>
  }

  if (!patient) {
    return <p className="p-6 text-sm text-muted-foreground">Loading patient record...</p>
  }

  const fullName = `${patient.firstName} ${patient.lastName}`
  const birthday = patient.dateOfBirth
    ? format(new Date(patient.dateOfBirth), 'MMM do, yyyy')
    : 'Not provided'
  const appointments = (() => {
    if (tab === 'records') return []
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    return (patient.appointments || [])
      .filter((appointment) => {
        const scheduledDate = new Date(appointment.scheduledDate)
        return tab === 'upcoming'
          ? scheduledDate >= startOfToday && appointment.status !== 'CANCELLED'
          : scheduledDate < startOfToday || appointment.status === 'CANCELLED'
      })
      .slice(0, 3)
  })()

  return (
    <div className="patient-360 -m-4 min-h-full bg-[#f3f7fc] p-4 text-[#111827] md:-m-6 md:p-7">
      <div className="mx-auto max-w-[1480px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() => router.push('/patients')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#086be6]"
          >
            <ArrowLeft className="h-4 w-4" /> {t('Patient list')}
          </button>
          <div className="flex items-center gap-2">
            <Link
              href={`/patients/${patient.id}/medical-history`}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold shadow-sm"
            >
              <FileText className="h-4 w-4" /> {t('Medical history')}
            </Link>
            <label className="hidden items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm text-slate-400 shadow-sm sm:flex">
              <Search className="h-4 w-4" />
              <input className="w-36 bg-transparent outline-none" placeholder="Search records" />
            </label>
            <Link
              href={`/patients/${patient.id}/edit`}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold shadow-sm"
            >
              <Edit3 className="h-4 w-4" /> {t('Edit patient')}
            </Link>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
          <div className="space-y-5">
            <section className="grid overflow-hidden rounded-[22px] border border-slate-100 bg-white shadow-[0_8px_30px_rgba(28,55,90,.06)] lg:grid-cols-[240px_1fr] 2xl:grid-cols-[300px_1fr]">
              <div className="flex flex-col items-center justify-center border-b p-8 text-center lg:border-b-0 lg:border-r">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#086be6] text-3xl font-semibold text-white ring-8 ring-[#eef5ff]">
                  {patient.firstName.charAt(0)}
                  {patient.lastName.charAt(0)}
                </div>
                <h1 className="mt-5 text-2xl font-semibold tracking-tight">{fullName}</h1>
                <p className="mt-1 text-sm text-slate-400">{patient.email || patient.patientId}</p>
                <div className="mt-5 flex items-center gap-6">
                  <div>
                    <p className="text-xl font-semibold">{patient._count?.treatments ?? 0}</p>
                    <p className="text-xs text-slate-400">{t('Past')}</p>
                  </div>
                  <span className="h-9 w-px bg-slate-200" />
                  <div>
                    <p className="text-xl font-semibold">{appointments.length}</p>
                    <p className="text-xs text-slate-400">{t('Upcoming')}</p>
                  </div>
                </div>
                <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition hover:border-[#086be6] hover:text-[#086be6]">
                  <MessageCircle className="h-4 w-4" /> {t('Send message')}
                </button>
              </div>

              <div className="grid content-center gap-x-8 gap-y-7 p-7 sm:grid-cols-2 min-[1450px]:grid-cols-3 lg:p-9">
                {[
                  ['Gender', patient.gender?.toLowerCase() || 'Not provided'],
                  ['Birthday', birthday],
                  ['Phone number', patient.phone],
                  ['Street address', patient.address || 'Not provided'],
                  ['City', patient.city || 'Not provided'],
                  ['ZIP code', patient.pincode || 'Not provided'],
                  ['Member status', 'Active member'],
                  [
                    'Registered date',
                    patient.createdAt
                      ? format(new Date(patient.createdAt), 'MMM do, yyyy')
                      : 'Not provided',
                  ],
                  ['Patient ID', patient.patientId],
                ].map(([label, value]) => (
                  <div key={label} className="border-b border-slate-100 pb-4">
                    <p className="text-xs font-medium uppercase tracking-[.08em] text-slate-400">
                      {t(label)}
                    </p>
                    <p className="mt-2 text-sm font-medium capitalize">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[22px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_rgba(28,55,90,.06)] sm:p-7">
              <div className="grid grid-cols-3 rounded-xl bg-[#f3f6fa] p-1">
                {(
                  [
                    ['upcoming', 'Upcoming appointments'],
                    ['past', 'Past appointments'],
                    ['records', 'Medical records'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setTab(value)}
                    className={`rounded-lg px-3 py-3 text-xs font-semibold transition sm:text-sm ${tab === value ? 'bg-white text-[#086be6] shadow-sm' : 'text-slate-400'}`}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-2xl bg-[#f1f4f8] p-4 sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="font-semibold">
                    {t(
                      tab === 'upcoming'
                        ? 'Upcoming appointments'
                        : tab === 'past'
                          ? 'Past appointments'
                          : 'Medical records'
                    )}
                  </h2>
                </div>
                {tab === 'upcoming' ? (
                  <div className="relative space-y-4 border-l-2 border-[#086be6] pl-5">
                    {appointments.map((appointment, index) => (
                      <article
                        key={appointment.id}
                        className="relative grid gap-4 rounded-xl bg-white p-5 shadow-sm md:grid-cols-[140px_1fr_1fr_auto] md:items-center"
                      >
                        <span
                          className={`absolute -left-[30px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-4 bg-white ${index ? 'border-[#086be6]' : 'border-emerald-400'}`}
                        />
                        <div>
                          <p className="text-xl font-medium">
                            {format(new Date(appointment.scheduledDate), 'dd MMM yy')}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {appointment.scheduledTime || t('Time not set')} ·{' '}
                            {appointment.duration || 30} min
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400">
                            Treatment
                          </p>
                          <p className="mt-1 font-semibold">
                            {appointment.appointmentType || t('Consultation')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400">Dentist</p>
                          <p className="mt-1 font-semibold">
                            {appointment.doctor
                              ? `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`
                              : t('Not assigned')}
                          </p>
                        </div>
                        <button aria-label="Appointment options">
                          <MoreHorizontal className="h-5 w-5 text-slate-400" />
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-48 flex-col items-center justify-center text-center text-slate-400">
                    <CalendarDays className="mb-3 h-9 w-9" />
                    <p className="font-medium">
                      No {tab === 'past' ? 'past appointments' : 'medical records'} to show
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-[22px] border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgba(28,55,90,.06)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 font-semibold">
                    <BellRing className="h-4 w-4 text-[#086be6]" /> Six-month recall
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">Check-up and SMS reminder tracking</p>
                </div>
                {['ADMIN', 'RECEPTIONIST'].includes(currentRole || '') && (
                  <button
                    onClick={scheduleRecall}
                    disabled={recallBusy}
                    className="rounded-xl bg-[#086be6] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {recallBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Schedule'}
                  </button>
                )}
              </div>

              {recallMessage && <p className="mt-3 text-xs text-slate-600">{recallMessage}</p>}

              <div className="mt-4 space-y-3">
                {recalls.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-400">
                    No recall scheduled.
                  </p>
                ) : (
                  recalls.slice(0, 3).map((recall) => (
                    <article key={recall.id} className="rounded-xl border border-slate-100 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            Follow-up {format(new Date(recall.followUpDate), 'MMM d, yyyy')}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Reminder {format(new Date(recall.reminderDate), 'MMM d, yyyy')} · SMS{' '}
                            {recall.smsStatus.toLowerCase()}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#eef5ff] px-2 py-1 text-[10px] font-semibold text-[#086be6]">
                          {recall.status.replace('_', ' ')}
                        </span>
                      </div>
                      {['ADMIN', 'RECEPTIONIST'].includes(currentRole || '') &&
                        !['RETURNED', 'CANCELLED'].includes(recall.status) && (
                          <button
                            onClick={() => markRecallReturned(recall.id)}
                            disabled={recallBusy}
                            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 disabled:opacity-60"
                          >
                            <CheckCircle2 className="h-4 w-4" /> Mark returned
                          </button>
                        )}
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-[22px] border border-slate-100 bg-white shadow-[0_8px_30px_rgba(28,55,90,.06)]">
              <div className="flex items-center justify-between px-6 py-5">
                <h2 className="font-semibold">{t('Notes')}</h2>
                <Link
                  href={`/patients/${patient.id}/medical-history`}
                  className="text-sm font-semibold text-[#086be6]"
                >
                  {t('Medical history')}
                </Link>
              </div>
              <div className="bg-[#f1f4f8] p-6 text-sm leading-6 text-slate-500">
                {t('Clinical notes are recorded in the patient medical history.')}
              </div>
            </section>

            <section className="rounded-[22px] border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgba(28,55,90,.06)]">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-semibold">{t('Files / documents')}</h2>
                <button className="inline-flex items-center gap-2 text-sm font-semibold text-[#086be6]">
                  <Upload className="h-4 w-4" /> {t('Add files')}
                </button>
              </div>
              <div className="divide-y">
                {(patient.documents || []).map((document) => (
                  <div key={document.id} className="flex items-center gap-3 py-4">
                    <span className="rounded-lg bg-[#eef5ff] p-2 text-[#086be6]">
                      <FileText className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {document.originalName || document.fileName}
                    </span>
                    <span className="text-xs text-slate-400">
                      {Math.round((document.fileSize || 0) / 1000)}kb
                    </span>
                    <button aria-label="Download document">
                      <Download className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
                ))}
              </div>
              <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-sm font-semibold text-slate-500">
                <Plus className="h-4 w-4" /> Upload document
              </button>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
