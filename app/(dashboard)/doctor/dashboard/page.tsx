'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Stethoscope,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Patient = {
  id: string
  patientId?: string
  firstName: string
  lastName: string
  phone?: string
}

type DoctorDashboardData = {
  stats: {
    appointmentsToday: number
    waitingPatients: number
    completedToday: number
    activeTreatments: number
  }
  appointments: Array<{
    id: string
    scheduledTime: string
    appointmentType: string
    status: string
    patient: Patient
  }>
  activeTreatments: Array<{
    id: string
    treatmentNo: string
    status: string
    patient: Patient
    procedure: { name: string }
  }>
  followUps: Array<{
    id: string
    followUpDate: string
    patient: Patient
    procedure: { name: string }
  }>
}

const statusClass: Record<string, string> = {
  CHECKED_IN: 'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-violet-100 text-violet-800',
  CONFIRMED: 'bg-emerald-100 text-emerald-800',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-slate-100 text-slate-700',
  PLANNED: 'bg-blue-100 text-blue-800',
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof Users
}) {
  return (
    <Card className="border-[#e6edf7] shadow-[0_12px_34px_rgba(31,60,102,0.055)]">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold text-[#13233a]">{value}</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-[#0769e7]">
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  )
}

export default function DoctorDashboardPage() {
  const [data, setData] = useState<DoctorDashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/dashboard/doctor')
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Doctor dashboard could not be loaded')
      setData(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Doctor dashboard could not be loaded')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return <div className="h-80 animate-pulse rounded-[28px] bg-white" />
  }

  if (error || !data) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Card className="max-w-xl text-center">
          <CardContent className="p-10">
            <RefreshCw className="mx-auto h-8 w-8 text-rose-500" />
            <h1 className="mt-4 text-2xl font-semibold">Doctor dashboard unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-5" onClick={load}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1540px] space-y-5 pb-8">
      <section className="rounded-[28px] bg-[#0a69e8] px-7 py-8 text-white shadow-[0_22px_55px_rgba(7,105,231,.2)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
          Doctor workspace
        </p>
        <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">Today’s clinical desk</h1>
            <p className="mt-2 text-blue-100">Your patients, active care, and due follow-ups.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/appointments/queue">
              <Button variant="secondary">Open queue</Button>
            </Link>
            <Link href="/treatments/new">
              <Button className="bg-white text-[#0769e7] hover:bg-blue-50">New treatment</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Appointments today"
          value={data.stats.appointmentsToday}
          icon={CalendarDays}
        />
        <Metric label="Waiting patients" value={data.stats.waitingPatients} icon={Users} />
        <Metric label="Completed today" value={data.stats.completedToday} icon={CheckCircle2} />
        <Metric label="Active treatments" value={data.stats.activeTreatments} icon={Stethoscope} />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Today’s appointments</CardTitle>
            <Link href="/appointments" className="text-sm font-semibold text-primary">
              Full schedule
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.appointments.length === 0 && (
              <p className="text-sm text-muted-foreground">No appointments assigned today.</p>
            )}
            {data.appointments.map((appointment) => (
              <Link
                key={appointment.id}
                href={`/appointments/${appointment.id}`}
                className="flex items-center justify-between rounded-2xl border p-4 hover:bg-muted/40"
              >
                <div>
                  <p className="font-medium">
                    {appointment.patient.firstName} {appointment.patient.lastName}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {appointment.scheduledTime} · {appointment.appointmentType.replaceAll('_', ' ')}
                  </p>
                </div>
                <Badge className={statusClass[appointment.status]}>
                  {appointment.status.replaceAll('_', ' ')}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Follow-ups due in 7 days</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.followUps.length === 0 && (
              <p className="text-sm text-muted-foreground">No follow-ups due.</p>
            )}
            {data.followUps.map((treatment) => (
              <Link
                key={treatment.id}
                href={`/treatments/${treatment.id}`}
                className="flex items-center justify-between rounded-2xl border p-4 hover:bg-muted/40"
              >
                <div>
                  <p className="font-medium">
                    {treatment.patient.firstName} {treatment.patient.lastName}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{treatment.procedure.name}</p>
                </div>
                <span className="flex items-center gap-2 text-sm text-amber-700">
                  <Clock3 className="h-4 w-4" />
                  {new Date(treatment.followUpDate).toLocaleDateString('en-ET')}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Active treatments</CardTitle>
          <Link
            href="/treatments"
            className="flex items-center gap-1 text-sm font-semibold text-primary"
          >
            All treatments <ArrowRight className="h-4 w-4" />
          </Link>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {data.activeTreatments.length === 0 && (
            <p className="text-sm text-muted-foreground">No active treatments.</p>
          )}
          {data.activeTreatments.map((treatment) => (
            <Link
              key={treatment.id}
              href={`/treatments/${treatment.id}`}
              className="rounded-2xl border p-4 hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {treatment.patient.firstName} {treatment.patient.lastName}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {treatment.procedure.name} · {treatment.treatmentNo}
                  </p>
                </div>
                <Badge className={statusClass[treatment.status]}>
                  {treatment.status.replaceAll('_', ' ')}
                </Badge>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
