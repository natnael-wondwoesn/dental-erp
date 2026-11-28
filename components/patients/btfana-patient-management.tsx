'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Plus, Search, UserPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  appointmentStatusLabel,
  appointmentTypeLabel,
  buildTodayVisits,
  localDateString,
  summarizeVisits,
  toVisitStatus,
  visitTypeLabel,
  VISIT_STATUS_LABEL,
  type AppointmentRange,
} from '@/lib/patient-management'

interface PatientRef {
  id: string
  patientId: string
  firstName: string
  lastName: string
  phone: string
}

interface Doctor {
  id: string
  firstName: string
  lastName: string
}

interface Appt {
  id: string
  status: string
  scheduledDate: string
  scheduledTime: string
  appointmentType: string
  checkedInAt?: string | null
  doctorId: string
  chiefComplaint?: string | null
  notes?: string | null
  patient: PatientRef
  doctor?: Doctor | null
}

interface PatientRow extends PatientRef {
  email?: string
  gender?: string
  age?: number
}

const POLL_MS = 30000

async function getJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

async function sendJson(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { data })
  return data
}

function doctorName(d?: Doctor | null) {
  return d ? `Dr. ${d.firstName} ${d.lastName}` : '-'
}

function fmtTime(t?: string | null) {
  if (!t) return '-'
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtSched(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function useDoctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  useEffect(() => {
    getJson('/api/staff/doctors')
      .then((d) => setDoctors(d.doctors ?? []))
      .catch(() => setDoctors([]))
  }, [])
  return doctors
}

/** Debounced patient lookup by name / phone / Patient ID using the shared patients API. */
function PatientPicker({
  selected,
  onSelect,
}: {
  selected: PatientRef | null
  onSelect: (p: PatientRef | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PatientRef[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    const handle = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await getJson(`/api/patients?search=${encodeURIComponent(q)}&limit=8`)
        setResults(data.patients ?? [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [query])

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-md border p-3 text-sm">
        <div>
          <div className="font-medium">
            {selected.firstName} {selected.lastName}
          </div>
          <div className="text-muted-foreground">
            {selected.patientId} · {selected.phone}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(null)}>
          Change
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, phone or Patient ID"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {searching && <p className="text-xs text-muted-foreground">Searching...</p>}
      {results.length > 0 && (
        <div className="max-h-48 overflow-auto rounded-md border">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => onSelect(p)}
            >
              <span>
                {p.firstName} {p.lastName}
              </span>
              <span className="text-xs text-muted-foreground">
                {p.patientId} · {p.phone}
              </span>
            </button>
          ))}
        </div>
      )}
      {query.trim().length >= 2 && !searching && results.length === 0 && (
        <p className="text-xs text-muted-foreground">No matching patient.</p>
      )}
      <Link href="/patients/new" className="inline-flex items-center gap-1 text-sm text-primary">
        <UserPlus className="h-4 w-4" /> Register new patient
      </Link>
    </div>
  )
}

function statusBadge(label: string, tone: string) {
  return <Badge className={`${tone} border-0`}>{label}</Badge>
}

const VISIT_TONE: Record<string, string> = {
  WAITING: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
}

const APPT_TONE: Record<string, string> = {
  SCHEDULED: 'bg-slate-100 text-slate-700',
  CONFIRMED: 'bg-sky-100 text-sky-700',
  CHECKED_IN: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-orange-100 text-orange-700',
  RESCHEDULED: 'bg-purple-100 text-purple-700',
}

// ---------------------------------------------------------------------------
// Today Visits
// ---------------------------------------------------------------------------
function TodayVisitsTab({ doctors }: { doctors: Doctor[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [appointments, setAppointments] = useState<Appt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [doctorFilter, setDoctorFilter] = useState('all')
  const [walkInOpen, setWalkInOpen] = useState(false)
  const [patient, setPatient] = useState<PatientRef | null>(null)
  const [walkInDoctor, setWalkInDoctor] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getJson('/api/appointments/today')
      setAppointments(data.appointments ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const handle = setInterval(load, POLL_MS)
    return () => clearInterval(handle)
  }, [load])

  const allVisits = useMemo(() => buildTodayVisits(appointments), [appointments])
  const summary = useMemo(() => summarizeVisits(allVisits), [allVisits])
  const visits = useMemo(
    () => buildTodayVisits(appointments, { search, doctorId: doctorFilter }),
    [appointments, search, doctorFilter]
  )

  const startConsultation = async (a: Appt) => {
    try {
      await sendJson(`/api/appointments/${a.id}/take`, 'POST')
      toast({ title: 'Consultation started' })
      load()
      router.push(`/appointments/${a.id}`)
    } catch (e) {
      toast({
        title: 'Could not start consultation',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
      load()
    }
  }

  const createVisit = async () => {
    if (!patient || !walkInDoctor) return
    setSaving(true)
    try {
      await sendJson('/api/appointments/walk-in', 'POST', {
        patientId: patient.id,
        doctorId: walkInDoctor,
      })
      toast({
        title: 'Patient checked in',
        description: `${patient.firstName} ${patient.lastName}`,
      })
      setWalkInOpen(false)
      setPatient(null)
      setWalkInDoctor('')
      load()
    } catch (e) {
      toast({
        title: 'Could not create visit',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
      load()
    } finally {
      setSaving(false)
    }
  }

  const cards = [
    { label: 'Total Patients', value: summary.total },
    { label: 'Waiting', value: summary.waiting },
    { label: 'In Progress', value: summary.inProgress },
    { label: 'Completed', value: summary.completed },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Today&apos;s Visits</h2>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString([], {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}{' '}
            · {summary.total} {summary.total === 1 ? 'visit' : 'visits'}
          </p>
        </div>
        <Button onClick={() => setWalkInOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Visit / Check In
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">{c.label}</div>
              <div className="text-3xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, phone or Patient ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={doctorFilter} onValueChange={setDoctorFilter}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="All doctors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All doctors</SelectItem>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {doctorName(d)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Visit Time</TableHead>
                  <TableHead>Assigned Doctor</TableHead>
                  <TableHead>Visit Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No visits today.
                    </TableCell>
                  </TableRow>
                ) : (
                  visits.map((a) => {
                    const vs = toVisitStatus(a.status)!
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.patient.patientId}</TableCell>
                        <TableCell className="font-medium">
                          {a.patient.firstName} {a.patient.lastName}
                        </TableCell>
                        <TableCell>{a.patient.phone}</TableCell>
                        <TableCell>{fmtTime(a.checkedInAt)}</TableCell>
                        <TableCell>{doctorName(a.doctor)}</TableCell>
                        <TableCell>{visitTypeLabel(a.appointmentType)}</TableCell>
                        <TableCell>{statusBadge(VISIT_STATUS_LABEL[vs], VISIT_TONE[vs])}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {vs === 'WAITING' && (
                              <>
                                <Button asChild size="sm" variant="outline">
                                  <Link href={`/patients/${a.patient.id}`}>
                                    Open Patient Profile
                                  </Link>
                                </Button>
                                <Button size="sm" onClick={() => startConsultation(a)}>
                                  Start Consultation
                                </Button>
                              </>
                            )}
                            {vs === 'IN_PROGRESS' && (
                              <>
                                <Button asChild size="sm">
                                  <Link href={`/appointments/${a.id}`}>Continue Consultation</Link>
                                </Button>
                                <Button asChild size="sm" variant="outline">
                                  <Link href={`/patients/${a.patient.id}`}>View Profile</Link>
                                </Button>
                              </>
                            )}
                            {vs === 'COMPLETED' && (
                              <>
                                <Button asChild size="sm" variant="outline">
                                  <Link href={`/appointments/${a.id}`}>View Visit Details</Link>
                                </Button>
                                <Button asChild size="sm" variant="outline">
                                  <Link href={`/patients/${a.patient.id}/medical-history`}>
                                    View Consultation Records
                                  </Link>
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={walkInOpen} onOpenChange={setWalkInOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Visit / Check In</DialogTitle>
            <DialogDescription>
              Find an existing patient and check them in for today.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <PatientPicker selected={patient} onSelect={setPatient} />
            <div className="space-y-2">
              <Label>Doctor (required)</Label>
              <Select value={walkInDoctor} onValueChange={setWalkInDoctor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {doctorName(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalkInOpen(false)}>
              Close
            </Button>
            <Button disabled={!patient || !walkInDoctor || saving} onClick={createVisit}>
              {saving ? 'Saving...' : 'Check In'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------
const PAGE_SIZE = 20

function AppointmentsTab({ doctors }: { doctors: Doctor[] }) {
  const { toast } = useToast()
  const [items, setItems] = useState<Appt[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<AppointmentRange>('today')
  const [date, setDate] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [newOpen, setNewOpen] = useState(false)
  const [reschedule, setReschedule] = useState<Appt | null>(null)
  const [rDate, setRDate] = useState('')
  const [rTime, setRTime] = useState('')
  const [form, setForm] = useState({
    date: localDateString(),
    time: '09:00',
    doctorId: '',
    type: 'CONSULTATION',
    reason: '',
    notes: '',
  })
  const [patient, setPatient] = useState<PatientRef | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmation, setConfirmation] = useState<Appt | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      const today = localDateString()
      if (date) params.set('date', date)
      else if (range === 'today') {
        params.set('dateFrom', today)
        params.set('dateTo', today)
      } else if (range === 'upcoming') params.set('dateFrom', today)
      if (search.trim()) params.set('search', search.trim())
      const data = await getJson(`/api/appointments?${params}`)
      setItems(data.appointments ?? [])
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, range, date, search])

  useEffect(() => {
    const handle = setTimeout(load, 250)
    return () => clearTimeout(handle)
  }, [load])

  const act = async (fn: () => Promise<unknown>, okTitle: string) => {
    try {
      await fn()
      toast({ title: okTitle })
    } catch (e) {
      toast({
        title: 'Action failed',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    }
    load()
  }

  const save = async () => {
    if (!patient || !form.doctorId || !form.date || !form.time) return
    setSaving(true)
    try {
      const created = await sendJson('/api/appointments', 'POST', {
        patientId: patient.id,
        doctorId: form.doctorId,
        scheduledDate: form.date,
        scheduledTime: form.time,
        appointmentType: form.type,
        chiefComplaint: form.reason || undefined,
        notes: form.notes || undefined,
      })
      setConfirmation(created)
      load()
    } catch (e) {
      toast({
        title: 'Could not save appointment',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const closeNew = () => {
    setNewOpen(false)
    setConfirmation(null)
    setPatient(null)
    setForm({ ...form, reason: '', notes: '' })
  }

  const filters: { key: AppointmentRange; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'all', label: 'All Appointments' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-semibold">Appointments</h2>
        <Button size="lg" onClick={() => setNewOpen(true)}>
          <Plus className="mr-2 h-5 w-5" /> New Appointment
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-2">
          {filters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={!date && range === f.key ? 'default' : 'outline'}
              onClick={() => {
                setDate('')
                setRange(f.key)
                setPage(1)
              }}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Input
          type="date"
          className="lg:w-44"
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            setPage(1)
          }}
        />
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, phone or Patient ID"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      No appointments found.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((a) => {
                    const canCheckIn = a.status === 'SCHEDULED' || a.status === 'CONFIRMED'
                    const open = !['CANCELLED', 'NO_SHOW', 'COMPLETED', 'RESCHEDULED'].includes(
                      a.status
                    )
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.patient.patientId}</TableCell>
                        <TableCell className="font-medium">
                          {a.patient.firstName} {a.patient.lastName}
                        </TableCell>
                        <TableCell>{a.patient.phone}</TableCell>
                        <TableCell>{new Date(a.scheduledDate).toLocaleDateString()}</TableCell>
                        <TableCell>{fmtSched(a.scheduledTime)}</TableCell>
                        <TableCell>{doctorName(a.doctor)}</TableCell>
                        <TableCell>{appointmentTypeLabel(a.appointmentType)}</TableCell>
                        <TableCell>
                          {statusBadge(appointmentStatusLabel(a.status), APPT_TONE[a.status] ?? '')}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Button asChild size="sm" variant="ghost">
                              <Link href={`/appointments/${a.id}`}>View</Link>
                            </Button>
                            {open && (
                              <>
                                <Button asChild size="sm" variant="ghost">
                                  <Link href={`/appointments/${a.id}/edit`}>Edit</Link>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setReschedule(a)
                                    setRDate(a.scheduledDate.slice(0, 10))
                                    setRTime(a.scheduledTime)
                                  }}
                                >
                                  Reschedule
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => {
                                    if (!window.confirm('Cancel this appointment?')) return
                                    act(
                                      () =>
                                        sendJson(`/api/appointments/${a.id}`, 'PUT', {
                                          status: 'CANCELLED',
                                        }),
                                      'Appointment cancelled'
                                    )
                                  }}
                                >
                                  Cancel
                                </Button>
                              </>
                            )}
                            {canCheckIn && (
                              <Button
                                size="sm"
                                onClick={() =>
                                  act(
                                    () => sendJson(`/api/appointments/${a.id}/check-in`, 'POST'),
                                    'Patient checked in'
                                  )
                                }
                              >
                                Check In
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={newOpen} onOpenChange={(o) => (o ? setNewOpen(true) : closeNew())}>
        <DialogContent>
          {confirmation ? (
            <>
              <DialogHeader>
                <DialogTitle>Appointment saved</DialogTitle>
                <DialogDescription>
                  Booked for {confirmation.patient.firstName} {confirmation.patient.lastName} (
                  {confirmation.patient.patientId}) on{' '}
                  {new Date(confirmation.scheduledDate).toLocaleDateString()} at{' '}
                  {fmtSched(confirmation.scheduledTime)} with {doctorName(confirmation.doctor)}.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={closeNew}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>New Appointment</DialogTitle>
                <DialogDescription>
                  Search an existing patient or register a new one.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <PatientPicker selected={patient} onSelect={setPatient} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      min={localDateString()}
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Doctor</Label>
                    <Select
                      value={form.doctorId}
                      onValueChange={(v) => setForm({ ...form, doctorId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select doctor" />
                      </SelectTrigger>
                      <SelectContent>
                        {doctors.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {doctorName(d)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CONSULTATION">New Consultation</SelectItem>
                        <SelectItem value="FOLLOW_UP">Follow-up</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reason for visit</Label>
                  <Input
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeNew}>
                  Close
                </Button>
                <Button disabled={!patient || !form.doctorId || saving} onClick={save}>
                  {saving ? 'Saving...' : 'Save Appointment'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!reschedule} onOpenChange={(o) => !o && setReschedule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule appointment</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                min={localDateString()}
                value={rDate}
                onChange={(e) => setRDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input type="time" value={rTime} onChange={(e) => setRTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReschedule(null)}>
              Close
            </Button>
            <Button
              disabled={!rDate || !rTime}
              onClick={() => {
                const target = reschedule
                setReschedule(null)
                if (target)
                  act(
                    () =>
                      sendJson(`/api/appointments/${target.id}`, 'PUT', {
                        scheduledDate: rDate,
                        scheduledTime: rTime,
                      }),
                    'Appointment rescheduled'
                  )
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// All Patients
// ---------------------------------------------------------------------------
function AllPatientsTab() {
  const [patients, setPatients] = useState<PatientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const handle = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(page), limit: '20' })
        if (search.trim()) params.set('search', search.trim())
        const data = await getJson(`/api/patients?${params}`)
        setPatients(data.patients ?? [])
        setTotalPages(data.pagination?.totalPages || 1)
        setTotal(data.pagination?.total ?? 0)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(handle)
  }, [page, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">All Patients</h2>
          <p className="text-sm text-muted-foreground">{total} registered patients</p>
        </div>
        <Button asChild>
          <Link href="/patients/new">
            <UserPlus className="mr-2 h-4 w-4" /> Register Patient
          </Link>
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, phone or Patient ID"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No patients found.
                    </TableCell>
                  </TableRow>
                ) : (
                  patients.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.patientId}</TableCell>
                      <TableCell className="font-medium">
                        {p.firstName} {p.lastName}
                      </TableCell>
                      <TableCell>{p.phone}</TableCell>
                      <TableCell>{p.gender ?? '-'}</TableCell>
                      <TableCell>{p.age ?? '-'}</TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/patients/${p.id}`}>Open Patient Profile</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function BtfanaPatientManagement() {
  const doctors = useDoctors()
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Patient Management</h1>
      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Today Visits</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="all">All Patients</TabsTrigger>
        </TabsList>
        <TabsContent value="today">
          <TodayVisitsTab doctors={doctors} />
        </TabsContent>
        <TabsContent value="appointments">
          <AppointmentsTab doctors={doctors} />
        </TabsContent>
        <TabsContent value="all">
          <AllPatientsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
