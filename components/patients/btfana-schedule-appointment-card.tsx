'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, Loader2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  buildTimeSlots,
  formatSlotLabel,
  isSlotUnavailable,
  todayInputValue,
} from '@/lib/appointment-slots'

interface Doctor {
  id: string
  firstName: string
  lastName: string
}

const TYPES = [
  { value: 'CONSULTATION', label: 'New Consultation' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
]

const SLOTS = buildTimeSlots()

/**
 * Schedule an appointment for the patient whose profile is open. It reuses the
 * existing appointments API, so the booking appears under Today / Upcoming / All
 * on the main Appointments page. It never registers a patient or creates a visit.
 */
export function BtfanaScheduleAppointmentCard({
  patientId,
  patientName,
  onScheduled,
}: {
  patientId: string
  patientName: string
  onScheduled?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [type, setType] = useState('CONSULTATION')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [taken, setTaken] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!open || doctors.length) return
    fetch('/api/staff/doctors')
      .then((r) => r.json())
      .then((d) => setDoctors(d.doctors ?? []))
      .catch(() => setDoctors([]))
  }, [open, doctors.length])

  // Slots already booked for the chosen doctor and day are greyed out.
  useEffect(() => {
    if (!date || !doctorId) {
      setTaken(new Set())
      return
    }
    let active = true
    fetch(`/api/appointments?doctorId=${doctorId}&dateFrom=${date}&dateTo=${date}&limit=100`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return
        const busySlots = (d.appointments ?? [])
          .filter(
            (a: { status: string }) => !['CANCELLED', 'NO_SHOW', 'RESCHEDULED'].includes(a.status)
          )
          .map((a: { scheduledTime: string }) => a.scheduledTime)
        setTaken(new Set<string>(busySlots))
      })
      .catch(() => active && setTaken(new Set()))
    return () => {
      active = false
    }
  }, [date, doctorId])

  const today = useMemo(() => todayInputValue(), [])
  const ready = Boolean(date && time && doctorId) && !busy

  async function submit() {
    if (!ready) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          doctorId,
          scheduledDate: date,
          scheduledTime: time,
          appointmentType: type,
          chiefComplaint: reason.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not schedule the appointment')
      const doctor = doctors.find((d) => d.id === doctorId)
      setMessage({
        tone: 'ok',
        text: `Appointment scheduled for ${patientName} on ${new Date(`${date}T00:00:00`).toLocaleDateString()} at ${formatSlotLabel(time)}${doctor ? ` with Dr. ${doctor.firstName} ${doctor.lastName}` : ''}.`,
      })
      setTime('')
      setReason('')
      setNotes('')
      setOpen(false)
      onScheduled?.()
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Could not schedule the appointment',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-[22px] border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgba(28,55,90,.06)]">
      <h2 className="flex items-center gap-2 font-semibold">
        <CalendarPlus className="h-4 w-4 text-[#086be6]" /> Schedule Appointment
      </h2>

      <div className="mt-4 flex items-center gap-2">
        <Checkbox
          id="schedule-toggle"
          checked={open}
          onCheckedChange={(v) => {
            setOpen(v === true)
            setMessage(null)
          }}
        />
        <Label htmlFor="schedule-toggle" className="cursor-pointer text-sm">
          Schedule an appointment
        </Label>
      </div>

      {message && (
        <p
          role="status"
          className={`mt-3 rounded-xl p-3 text-sm ${message.tone === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
        >
          {message.text}
        </p>
      )}

      <div
        className={`grid transition-all duration-300 ease-in-out ${open ? 'mt-4 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div className="space-y-4">
            <div>
              <Label htmlFor="apt-date">Appointment Date</Label>
              <Input
                id="apt-date"
                type="date"
                min={today}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  setTime('')
                }}
              />
            </div>

            <div>
              <Label>Assigned Doctor</Label>
              <Select
                value={doctorId}
                onValueChange={(v) => {
                  setDoctorId(v)
                  setTime('')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      Dr. {d.firstName} {d.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Time</Label>
              <Select value={time} onValueChange={setTime} disabled={!date || !doctorId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={date && doctorId ? 'Select time' : 'Pick date and doctor first'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {SLOTS.map((slot) => {
                    const unavailable = isSlotUnavailable(slot, date, taken)
                    return (
                      <SelectItem key={slot} value={slot} disabled={unavailable}>
                        {formatSlotLabel(slot)}
                        {unavailable ? ' (unavailable)' : ''}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Appointment Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="apt-reason">Reason for Appointment (optional)</Label>
              <Input id="apt-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>

            <div>
              <Label htmlFor="apt-notes">Additional Notes (optional)</Label>
              <Textarea id="apt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <Button onClick={submit} disabled={!ready} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Schedule Appointment'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
