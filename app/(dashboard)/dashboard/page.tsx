'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  Plus,
  ReceiptText,
  RefreshCw,
  Stethoscope,
  UserPlus,
  Users,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { ErpCommandCenter } from '@/components/dashboard/erp-overview'
import { useLanguage } from '@/lib/i18n'

type DashboardStats = {
  overview: {
    totalPatients: number
    newPatientsThisMonth: number
    patientGrowth: number
    todayAppointments: number
    thisMonthAppointments: number
    appointmentGrowth: number
    pendingAppointments: number
    completedAppointmentsToday: number
    waitingPatients: number
    thisMonthRevenue: number
    todayRevenue: number
    revenueGrowth: number
    pendingPayments: number
    totalRevenue: number
    monthExpenses: number
    netCashFlow: number
    activeLabOrders: number
  }
  charts: {
    last7DaysRevenue: Array<{ date: string; revenue: number }>
    appointmentsByStatus: Array<{ status: string; count: number }>
  }
  recentActivity: {
    upcomingAppointments: Array<{
      id: string
      patientName: string
      patientNumber: string
      doctorName: string
      date: string
      type: string
      status: string
      chairLabel?: string | null
    }>
    labAlerts: Array<{
      id: string
      orderNumber: string
      applianceType: string
      vendorName: string
      dueDate?: string | null
      status: string
    }>
  }
  currency: string
  timezone: string
  generatedAt: string
}

const statusStyle: Record<string, string> = {
  CHECKED_IN: 'bg-amber-50 text-amber-700 ring-amber-600/10',
  IN_CHAIR: 'bg-violet-50 text-violet-700 ring-violet-600/10',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  SCHEDULED: 'bg-blue-50 text-blue-700 ring-blue-600/10',
  COMPLETED: 'bg-slate-100 text-slate-600 ring-slate-600/10',
}

function formatMoney(value: number, currency = 'ETB') {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  detail: string
  icon: typeof Users
  accent: string
}) {
  return (
    <article className="group rounded-[22px] border border-[#e6edf7] bg-white p-5 shadow-[0_12px_34px_rgba(31,60,102,0.055)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(31,60,102,0.09)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {label}
          </p>
          <p className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-[#13233a]">
            {value}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
        </div>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  )
}

export default function DashboardPage() {
  const { locale, t } = useLanguage()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/dashboard/stats')
      if (!response.ok) throw new Error('The clinic overview could not be loaded')
      setStats(await response.json())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The clinic overview could not be loaded')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const chartData = useMemo(
    () =>
      (stats?.charts.last7DaysRevenue || []).map((point) => ({
        ...point,
        label: new Intl.DateTimeFormat(locale === 'am' ? 'am-ET' : 'en-ET', {
          weekday: 'short',
        }).format(new Date(`${point.date}T12:00:00`)),
      })),
    [locale, stats]
  )

  const todayLabel = new Intl.DateTimeFormat(locale === 'am' ? 'am-ET' : 'en-ET', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  if (loading) {
    return (
      <div className="mx-auto max-w-[1540px] animate-pulse space-y-6">
        <div className="h-32 rounded-[28px] bg-white" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-36 rounded-[22px] bg-white" />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <div className="h-[420px] rounded-[24px] bg-white" />
          <div className="h-[420px] rounded-[24px] bg-white" />
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <section className="mx-auto grid min-h-[65vh] max-w-2xl place-items-center text-center">
        <div className="rounded-[28px] border border-rose-100 bg-white p-10 shadow-sm">
          <RefreshCw className="mx-auto h-9 w-9 text-rose-500" />
          <h1 className="mt-5 text-2xl font-semibold text-[#13233a]">
            Clinic overview unavailable
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{error}</p>
          <button
            onClick={loadDashboard}
            className="mt-6 rounded-full bg-[#0769e7] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(7,105,231,.22)]"
          >
            Try again
          </button>
        </div>
      </section>
    )
  }

  const overview = stats.overview
  const appointments = stats.recentActivity.upcomingAppointments
  const currency = stats.currency || 'ETB'

  return (
    <div className="clinic-dashboard mx-auto max-w-[1540px] space-y-5 pb-8 text-[#13233a]">
      <section className="relative overflow-hidden rounded-[28px] bg-[#0a69e8] px-6 py-7 text-white shadow-[0_22px_55px_rgba(7,105,231,.2)] sm:px-8 lg:flex lg:items-center lg:justify-between lg:px-10">
        <div className="absolute -right-16 -top-32 h-80 w-80 rounded-full border-[54px] border-white/10" />
        <div className="absolute bottom-0 right-1/4 h-28 w-28 translate-y-1/2 rounded-full bg-cyan-300/30 blur-xl" />
        <div className="relative max-w-2xl">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
            <span>{t('Clinic command centre')}</span>
            <span className="h-1 w-1 rounded-full bg-blue-200" />
            <span>{todayLabel}</span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            {t('Good morning. Your clinic is ready.')}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
            {t('A focused view of today’s patients, care delivery and ETB cash position.')}
          </p>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-3 lg:mt-0 lg:justify-end">
          <Link
            href="/appointments/new"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#0769e7] shadow-lg transition hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" /> {t('Book appointment')}
          </Link>
          <Link
            href="/patients/new"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            <UserPlus className="h-4 w-4" /> {t('Register patient')}
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Clinic metrics">
        <MetricCard
          label={t('Today’s appointments')}
          value={overview.todayAppointments.toLocaleString()}
          detail={`${overview.waitingPatients} ${t('waiting')} · ${overview.completedAppointmentsToday} ${t('completed')}`}
          icon={CalendarDays}
          accent="bg-blue-50 text-[#0769e7]"
        />
        <MetricCard
          label={t('Active patients')}
          value={overview.totalPatients.toLocaleString()}
          detail={`+${overview.newPatientsThisMonth} ${t('registered this month')}`}
          icon={Users}
          accent="bg-cyan-50 text-cyan-700"
        />
        <MetricCard
          label={t('Revenue this month')}
          value={formatMoney(overview.thisMonthRevenue, currency)}
          detail={`${formatMoney(overview.todayRevenue, currency)} ${t('collected today')}`}
          icon={CircleDollarSign}
          accent="bg-emerald-50 text-emerald-700"
        />
        <MetricCard
          label={t('Outstanding balance')}
          value={formatMoney(overview.pendingPayments, currency)}
          detail={`${overview.activeLabOrders} ${t('active lab cases')}`}
          icon={ReceiptText}
          accent="bg-amber-50 text-amber-700"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <article className="overflow-hidden rounded-[24px] border border-[#e6edf7] bg-white shadow-[0_12px_34px_rgba(31,60,102,0.055)]">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0769e7]">
                {t('Today’s flow')}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">
                {t('Upcoming appointments')}
              </h2>
            </div>
            <Link
              href="/appointments"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0769e7]"
            >
              {t('View schedule')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {appointments.length ? (
              appointments.slice(0, 5).map((appointment) => {
                const timeLabel = new Intl.DateTimeFormat('en-ET', {
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(appointment.date))
                return (
                  <Link
                    key={appointment.id}
                    href={`/appointments/${appointment.id}`}
                    className="grid gap-4 px-6 py-4 transition hover:bg-[#f7faff] sm:grid-cols-[76px_1fr_auto] sm:items-center sm:px-7"
                  >
                    <div>
                      <p className="text-lg font-semibold tracking-tight">{timeLabel}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {appointment.chairLabel || '—'}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">{appointment.patientName}</p>
                        <span className="hidden text-xs text-slate-400 md:inline">
                          {appointment.patientNumber}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {appointment.type} · {appointment.doctorName}
                      </p>
                    </div>
                    <span
                      className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] ring-1 ring-inset ${statusStyle[appointment.status] || statusStyle.SCHEDULED}`}
                    >
                      {appointment.status.replaceAll('_', ' ')}
                    </span>
                  </Link>
                )
              })
            ) : (
              <div className="grid min-h-64 place-items-center px-6 text-center">
                <div>
                  <CalendarDays className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 font-semibold">{t('No appointments remaining today')}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {t('The next booked visit will appear here.')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[24px] border border-[#e6edf7] bg-white p-6 shadow-[0_12px_34px_rgba(31,60,102,0.055)] sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0769e7]">
                {t('Cash position')}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">
                {t('7-day collections')}
              </h2>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              {currency}
            </span>
          </div>
          <div className="mt-5 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 2, left: 2, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0769e7" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#0769e7" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e9eff7" strokeDasharray="3 5" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value), currency)}
                  contentStyle={{
                    borderRadius: 14,
                    borderColor: '#e6edf7',
                    boxShadow: '0 12px 30px rgba(31,60,102,.12)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0769e7"
                  strokeWidth={3}
                  fill="url(#revenueFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#f4f8fd] p-4">
              <p className="text-xs text-slate-500">{t('Net cash flow')}</p>
              <p className="mt-1 font-semibold">{formatMoney(overview.netCashFlow, currency)}</p>
            </div>
            <div className="rounded-2xl bg-[#f4f8fd] p-4">
              <p className="text-xs text-slate-500">{t('Month expenses')}</p>
              <p className="mt-1 font-semibold">{formatMoney(overview.monthExpenses, currency)}</p>
            </div>
          </div>
        </article>
      </section>

      <ErpCommandCenter />
    </div>
  )
}
