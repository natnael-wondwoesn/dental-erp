'use client'

import Image from 'next/image'
import Link from 'next/link'
import { use, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  ArrowLeft,
  CalendarDays,
  Download,
  Edit3,
  FileText,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Upload,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n'

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
  }>
  documents?: Array<{ id: string; originalName?: string; fileName?: string; fileSize?: number }>
  _count?: { appointments?: number; treatments?: number; documents?: number }
}

const demoPatient: Patient = {
  id: 'demo',
  patientId: 'ET-PAT-2026-0001',
  firstName: 'Lulit',
  lastName: 'Bekele',
  email: 'lulit.bekele@example.com',
  phone: '+251 911 234 567',
  dateOfBirth: '1997-02-24',
  gender: 'FEMALE',
  address: 'Bole Medhanialem, Namibia St.',
  city: 'Addis Ababa',
  state: 'Addis Ababa',
  pincode: '1000',
  createdAt: '2025-11-20T09:00:00Z',
  appointments: [
    {
      id: '1',
      scheduledDate: '2026-11-26',
      scheduledTime: '09:00',
      status: 'CONFIRMED',
      appointmentType: 'Open access',
    },
    {
      id: '2',
      scheduledDate: '2026-12-12',
      scheduledTime: '10:30',
      status: 'SCHEDULED',
      appointmentType: 'Root canal prep',
    },
  ],
  documents: [
    { id: '1', originalName: 'Check Up Result.pdf', fileSize: 126000 },
    { id: '2', originalName: 'Dental X-Ray Result 2.pdf', fileSize: 98000 },
    { id: '3', originalName: 'Medical Prescriptions.pdf', fileSize: 87000 },
  ],
  _count: { appointments: 17, treatments: 15, documents: 3 },
}

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { t } = useLanguage()
  const [patient, setPatient] = useState<Patient>(demoPatient)
  const [tab, setTab] = useState<'upcoming' | 'past' | 'records'>('upcoming')
  const [note, setNote] = useState(
    'Patient prefers morning appointments.\nHistory of sensitivity to cold drinks; Amharic preferred.'
  )
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/patients/${id}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setPatient((current) => ({ ...current, ...data.patient })))
      .catch(() => undefined)
  }, [id])

  const fullName = `${patient.firstName} ${patient.lastName}`
  const birthday = patient.dateOfBirth
    ? format(new Date(patient.dateOfBirth), 'MMM do, yyyy')
    : 'Not provided'
  const appointments = useMemo(
    () => patient.appointments?.slice(0, 3) || [],
    [patient.appointments]
  )

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
                <Image
                  src="/assets/patient-lulit.png"
                  alt={fullName}
                  width={104}
                  height={104}
                  className="h-24 w-24 rounded-full object-cover ring-8 ring-[#eef5ff]"
                />
                <h1 className="mt-5 text-2xl font-semibold tracking-tight">{fullName}</h1>
                <p className="mt-1 text-sm text-slate-400">{patient.email || patient.patientId}</p>
                <div className="mt-5 flex items-center gap-6">
                  <div>
                    <p className="text-xl font-semibold">{patient._count?.treatments ?? 15}</p>
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
                      : 'Nov 20th, 2025',
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
                  <h2 className="font-semibold">Root canal treatment</h2>
                  <button className="rounded-lg bg-white px-3 py-2 text-xs text-slate-500">
                    Show previous treatment
                  </button>
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
                            {appointment.scheduledTime || '09:00'} · 60 min
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400">
                            Treatment
                          </p>
                          <p className="mt-1 font-semibold">
                            {appointment.appointmentType || 'Consultation'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400">Dentist</p>
                          <p className="mt-1 font-semibold">Dr. Hana Tesfaye</p>
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
            <section className="overflow-hidden rounded-[22px] border border-slate-100 bg-white shadow-[0_8px_30px_rgba(28,55,90,.06)]">
              <div className="flex items-center justify-between px-6 py-5">
                <h2 className="font-semibold">{t('Notes')}</h2>
                <button className="text-sm font-semibold text-[#086be6]">See all</button>
              </div>
              <div className="bg-[#f1f4f8] p-5">
                <textarea
                  value={note}
                  onChange={(event) => {
                    setNote(event.target.value)
                    setSaved(false)
                  }}
                  className="min-h-36 w-full resize-none bg-transparent text-sm leading-7 outline-none"
                  aria-label="Patient note"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => setSaved(true)}
                    className="rounded-lg bg-[#086be6] px-4 py-2 text-xs font-semibold text-white"
                  >
                    {saved ? t('Saved') : t('Save note')}
                  </button>
                </div>
              </div>
              <div className="px-6 py-4">
                <p className="text-sm">{note.split('\n')[0]}</p>
                <p className="mt-2 text-xs text-slate-400">Dr. Hana Tesfaye · just now</p>
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
                {(patient.documents || demoPatient.documents || []).map((document) => (
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
