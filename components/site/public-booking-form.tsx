'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react'

import { useLanguage } from '@/lib/i18n'

type Doctor = {
  id: string
  firstName: string
  lastName: string
  specialization: string | null
}

type Slot = { time: string; available: boolean }

type BookingResult = {
  appointmentNo: string
  date: string
  time: string
  doctor: string
}

export function PublicBookingIntro() {
  const { t } = useLanguage()
  return (
    <section className="pt-4 lg:sticky lg:top-36">
      <div className="inline-flex items-center gap-2 rounded-full border border-[#0877ea]/15 bg-white/80 px-4 py-2 text-sm font-semibold text-[#24547e]">
        <ShieldCheck className="h-4 w-4 text-[#0877ea]" /> {t('Private and secure')}
      </div>
      <h1 className="mt-6 text-5xl font-medium leading-[.98] tracking-[-.055em] sm:text-6xl">
        {t('Book your dental visit.')}
      </h1>
      <p className="mt-6 max-w-lg text-lg leading-8 text-[#52667d]">
        {t(
          'Choose your doctor and a real available time. New patients are welcome—no staff account or patient login is needed.'
        )}
      </p>
      <div className="mt-8 space-y-4 text-sm text-[#52667d]">
        <p className="flex items-center gap-3">
          <UserRound className="h-5 w-5 text-[#0877ea]" /> {t('Enter your contact details')}
        </p>
        <p className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-[#0877ea]" />{' '}
          {t('Pick a doctor, date, and free time')}
        </p>
        <p className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-[#0877ea]" />{' '}
          {t('Receive your booking reference instantly')}
        </p>
      </div>
    </section>
  )
}

export function PublicBookingForm({ clinicSlug }: { clinicSlug: string }) {
  const { t } = useLanguage()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [hospitalName, setHospitalName] = useState('Sunny Smile Speciality Clinic')
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [slots, setSlots] = useState<Slot[]>([])
  const [error, setError] = useState('')
  const [result, setResult] = useState<BookingResult | null>(null)
  const [doctorId, setDoctorId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  const today = useMemo(() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Addis_Ababa',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    const value = (type: string) => parts.find((part) => part.type === type)?.value
    return `${value('year')}-${value('month')}-${value('day')}`
  }, [])

  useEffect(() => {
    let active = true
    fetch(`/api/public/${encodeURIComponent(clinicSlug)}/doctors`)
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Online booking is unavailable right now')
        if (active) {
          setDoctors(data.doctors || [])
          setHospitalName(data.hospitalName || 'Sunny Smile Speciality Clinic')
        }
      })
      .catch((caught: Error) => active && setError(caught.message))
      .finally(() => active && setLoadingDoctors(false))
    return () => {
      active = false
    }
  }, [clinicSlug])

  useEffect(() => {
    if (!doctorId || !date) {
      setSlots([])
      setTime('')
      return
    }
    const controller = new AbortController()
    setLoadingSlots(true)
    setTime('')
    setError('')
    fetch(
      `/api/public/${encodeURIComponent(clinicSlug)}/slots?doctorId=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}`,
      { signal: controller.signal }
    )
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load appointment times')
        setSlots(data.slots || [])
      })
      .catch((caught: Error) => {
        if (caught.name !== 'AbortError') setError(caught.message)
      })
      .finally(() => setLoadingSlots(false))
    return () => controller.abort()
  }, [clinicSlug, date, doctorId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`/api/public/${encodeURIComponent(clinicSlug)}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.get('firstName'),
          lastName: form.get('lastName'),
          phone: form.get('phone'),
          email: form.get('email'),
          doctorId,
          date,
          time,
          chiefComplaint: form.get('chiefComplaint'),
          website: form.get('website'),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not book the appointment')
      setResult(data.appointment)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not book the appointment')
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="rounded-[30px] border border-emerald-200 bg-white p-8 text-center shadow-[0_30px_80px_-45px_rgba(11,45,83,.5)] sm:p-12">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h2 className="mt-5 text-3xl font-semibold tracking-tight">
          {t('Your appointment is booked')}
        </h2>
        <p className="mt-3 text-slate-600">{t('Please save this appointment reference.')}</p>
        <div className="mx-auto mt-7 max-w-sm rounded-2xl bg-[#eef6ff] p-5 text-left text-sm leading-7 text-slate-700">
          <p>
            <strong>{t('Reference')}:</strong> {result.appointmentNo}
          </p>
          <p>
            <strong>{t('Doctor')}:</strong> {result.doctor}
          </p>
          <p>
            <strong>{t('Date')}:</strong> {String(result.date).slice(0, 10)}
          </p>
          <p>
            <strong>{t('Time')}:</strong> {result.time}
          </p>
        </div>
        <a
          href="/"
          className="mt-8 inline-flex rounded-full bg-[#0877ea] px-7 py-3 font-semibold text-white"
        >
          {t('Return home')}
        </a>
      </div>
    )
  }

  const availableSlots = slots.filter((slot) => slot.available)
  const fieldClass =
    'mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-[#0877ea] focus:ring-4 focus:ring-[#0877ea]/10'

  return (
    <form
      onSubmit={submit}
      className="rounded-[30px] border border-white bg-white/95 p-6 shadow-[0_30px_80px_-45px_rgba(11,45,83,.5)] sm:p-10"
    >
      <div className="mb-8 flex items-start gap-4 border-b border-slate-100 pb-7">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e9f4ff] text-[#0877ea]">
          <CalendarDays />
        </span>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t('Choose your appointment')}</h2>
          <p className="mt-1 text-sm text-slate-500">{hospitalName}</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium">
          {t('First name')}
          <input
            name="firstName"
            required
            minLength={2}
            autoComplete="given-name"
            className={fieldClass}
          />
        </label>
        <label className="text-sm font-medium">
          {t('Last name')}
          <input
            name="lastName"
            required
            minLength={2}
            autoComplete="family-name"
            className={fieldClass}
          />
        </label>
        <label className="text-sm font-medium">
          {t('Phone number')}
          <input
            name="phone"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="0911 234 567"
            className={fieldClass}
          />
        </label>
        <label className="text-sm font-medium">
          {t('Email (optional)')}
          <input name="email" type="email" autoComplete="email" className={fieldClass} />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          {t('Choose a doctor')}
          <select
            required
            value={doctorId}
            onChange={(event) => setDoctorId(event.target.value)}
            disabled={loadingDoctors}
            className={fieldClass}
          >
            <option value="">
              {loadingDoctors ? t('Loading doctors…') : t('Select a doctor')}
            </option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                Dr. {doctor.firstName} {doctor.lastName}
                {doctor.specialization ? ` — ${doctor.specialization}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          {t('Appointment date')}
          <input
            type="date"
            required
            min={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={fieldClass}
          />
        </label>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium">{t('Available time')}</legend>
        {loadingSlots ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('Loading available times…')}
          </p>
        ) : doctorId && date ? (
          availableSlots.length ? (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {availableSlots.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  onClick={() => setTime(slot.time)}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${time === slot.time ? 'border-[#0877ea] bg-[#0877ea] text-white' : 'border-slate-200 bg-white hover:border-[#0877ea]'}`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              {t('No free times are available on this date.')}
            </p>
          )
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            {t('Select a doctor and date to see free times.')}
          </p>
        )}
      </fieldset>

      <label className="mt-6 block text-sm font-medium">
        {t('What would you like help with? (optional)')}
        <textarea
          name="chiefComplaint"
          maxLength={1000}
          rows={4}
          className={`${fieldClass} h-auto py-3`}
        />
      </label>
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      {error && (
        <div role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={!doctorId || !date || !time || submitting}
        className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0877ea] px-7 py-4 font-semibold text-white shadow-[0_18px_38px_-18px_rgba(8,119,234,.9)] transition hover:bg-[#0663c5] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Clock3 className="h-5 w-5" />}
        {submitting ? t('Booking…') : t('Confirm appointment')}
      </button>
      <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
        <Phone className="h-3.5 w-3.5" /> {t('The clinic may call you to confirm your visit.')}
      </p>
    </form>
  )
}
