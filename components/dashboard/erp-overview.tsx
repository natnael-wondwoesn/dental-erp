'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  CircleDollarSign,
  FileBarChart2,
  FlaskConical,
  ReceiptText,
  Stethoscope,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type MetricKind = 'number' | 'currency' | 'percentage'
type ModuleKey =
  | 'patients'
  | 'appointments'
  | 'treatments'
  | 'billing'
  | 'lab'
  | 'reports'
  | 'finance'

type SummaryMetric = {
  label: string
  value: number
  kind: MetricKind
}

type ModuleSnapshot = {
  metrics: SummaryMetric[]
  alerts: string[]
}

type ErpSummaryResponse = {
  currency: string
  timezone: string
  generatedAt: string
  commandCenter: {
    metrics: SummaryMetric[]
    notes: string[]
  }
  modules: Record<ModuleKey, ModuleSnapshot>
}

type ModuleBlueprint = {
  title: string
  description: string
  href: string
  icon: LucideIcon
  tone: string
  workflow: string[]
  actions: Array<{ label: string; href: string }>
}

const emptyMetric = (label: string, kind: MetricKind = 'number'): SummaryMetric => ({
  label,
  value: 0,
  kind,
})

const moduleBlueprints: Record<ModuleKey, ModuleBlueprint> = {
  patients: {
    title: 'Patient management',
    description: 'Registration, profile data, medical history, documents, insurance and records.',
    href: '/patients',
    icon: Users,
    tone: 'bg-sky-50 text-sky-700',
    workflow: ['Registration', 'Profile & demographics', 'History & records', 'Insurance & documents'],
    actions: [
      { label: 'Register patient', href: '/patients/new' },
      { label: 'Browse patients', href: '/patients' },
    ],
  },
  appointments: {
    title: 'Appointments',
    description: 'Scheduling, chair allocation, check-in flow, calendars and follow-up booking.',
    href: '/appointments',
    icon: CalendarClock,
    tone: 'bg-indigo-50 text-indigo-700',
    workflow: ['Scheduling', 'Chair allocation', 'Check-in & waiting', 'Follow-up booking'],
    actions: [
      { label: 'Book appointment', href: '/appointments/new' },
      { label: 'Open schedule', href: '/appointments' },
    ],
  },
  treatments: {
    title: 'Assessment & treatment',
    description: 'Assessment, diagnosis, treatment planning, procedures and follow-up coordination.',
    href: '/treatments',
    icon: Stethoscope,
    tone: 'bg-emerald-50 text-emerald-700',
    workflow: ['Assessment', 'Diagnosis', 'Treatment planning', 'Procedures & follow-up'],
    actions: [
      { label: 'Create treatment', href: '/treatments/new' },
      { label: 'View treatments', href: '/treatments' },
    ],
  },
  billing: {
    title: 'Billing',
    description: 'Invoices, payments, payment plans, receipts, insurance claims and pre-auth.',
    href: '/billing',
    icon: ReceiptText,
    tone: 'bg-amber-50 text-amber-700',
    workflow: ['Invoices', 'Collections', 'Payment plans', 'Insurance workflow'],
    actions: [
      { label: 'New invoice', href: '/billing/invoices/new' },
      { label: 'Open billing', href: '/billing' },
    ],
  },
  lab: {
    title: 'Dental laboratory',
    description: 'Cases, appliances, vendor coordination, remake tracking and delivery readiness.',
    href: '/lab',
    icon: FlaskConical,
    tone: 'bg-violet-50 text-violet-700',
    workflow: ['Case orders', 'Appliance tracking', 'Vendor management', 'QC & delivery'],
    actions: [
      { label: 'New lab order', href: '/lab/orders/new' },
      { label: 'Manage lab', href: '/lab' },
    ],
  },
  reports: {
    title: 'Reports & analytics',
    description: 'Patient, clinical, financial and operational reporting from shared ERP data.',
    href: '/reports',
    icon: FileBarChart2,
    tone: 'bg-cyan-50 text-cyan-700',
    workflow: ['Patient analytics', 'Clinical output', 'Revenue reporting', 'Operational KPIs'],
    actions: [
      { label: 'Open reports', href: '/reports' },
      { label: 'Financial reports', href: '/billing/reports' },
    ],
  },
  finance: {
    title: 'Accounting & finance',
    description: 'Income, expenses, cash flow, receivables and finance-facing reporting.',
    href: '/finance',
    icon: CircleDollarSign,
    tone: 'bg-rose-50 text-rose-700',
    workflow: ['Income tracking', 'Expense posting', 'Cash flow', 'Receivables'],
    actions: [
      { label: 'Open finance', href: '/finance' },
      { label: 'Review billing', href: '/billing' },
    ],
  },
}

function formatMetric(metric: SummaryMetric, currency: string) {
  if (metric.kind === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(metric.value)
  }

  if (metric.kind === 'percentage') {
    return `${metric.value}%`
  }

  return new Intl.NumberFormat('en-US').format(metric.value)
}

function getDefaultModuleSnapshot(moduleId: ModuleKey): ModuleSnapshot {
  switch (moduleId) {
    case 'patients':
      return {
        metrics: [
          emptyMetric('Total patients'),
          emptyMetric('New this month'),
          emptyMetric('Patients with balances'),
        ],
        alerts: ['Patient intake and clinical records will appear here once data is available.'],
      }
    case 'appointments':
      return {
        metrics: [
          emptyMetric('Today scheduled'),
          emptyMetric('Checked in now'),
          emptyMetric('30-day no-show rate', 'percentage'),
        ],
        alerts: ['Scheduling signals will appear here once appointment activity is available.'],
      }
    case 'treatments':
      return {
        metrics: [
          emptyMetric('Plans in progress'),
          emptyMetric('Treatments in chair'),
          emptyMetric('Completed this month'),
        ],
        alerts: ['Treatment coordination signals will appear here once procedures are recorded.'],
      }
    case 'billing':
      return {
        metrics: [
          emptyMetric('Collected this month', 'currency'),
          emptyMetric('Open invoices'),
          emptyMetric('Outstanding balance', 'currency'),
        ],
        alerts: ['Billing workflow signals will appear here once revenue-cycle data is available.'],
      }
    case 'lab':
      return {
        metrics: [
          emptyMetric('Active lab cases'),
          emptyMetric('Ready for delivery'),
          emptyMetric('Active vendors'),
        ],
        alerts: ['Lab coordination signals will appear here once case data is available.'],
      }
    case 'reports':
      return {
        metrics: [
          emptyMetric('Revenue growth', 'percentage'),
          emptyMetric('No-show rate', 'percentage'),
          emptyMetric('Low-stock items'),
        ],
        alerts: ['Cross-module reporting signals will appear here once analytics data is available.'],
      }
    case 'finance':
      return {
        metrics: [
          emptyMetric('Revenue this month', 'currency'),
          emptyMetric('Expenses this month', 'currency'),
          emptyMetric('Net cash flow', 'currency'),
        ],
        alerts: ['Finance signals will appear here once collections and expenses are posted.'],
      }
  }
}

function useErpSummary() {
  const [data, setData] = useState<ErpSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadSummary() {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch('/api/dashboard/modules')
        if (!response.ok) throw new Error('Failed to load ERP summary')
        const result = (await response.json()) as ErpSummaryResponse
        if (!cancelled) setData(result)
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Failed to load ERP summary')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadSummary()
    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading, error }
}

function OverviewMetric({
  metric,
  currency,
  className,
}: {
  metric: SummaryMetric
  currency: string
  className?: string
}) {
  return (
    <div className={cn('rounded-2xl border border-white/15 bg-white/85 p-4 shadow-sm', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {metric.label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#13233a]">
        {formatMetric(metric, currency)}
      </p>
    </div>
  )
}

function CommandCenterSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-[#dce7f5]">
        <CardContent className="p-6 sm:p-8">
          <div className="space-y-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-80" />
            <Skeleton className="h-4 w-full max-w-2xl" />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl" />
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-72 rounded-3xl" />
        ))}
      </div>
    </div>
  )
}

export function ErpCommandCenter() {
  const { data, loading, error } = useErpSummary()

  if (loading) return <CommandCenterSkeleton />
  if (error || !data) return null

  const commandCenterMetrics =
    data.commandCenter?.metrics?.length
      ? data.commandCenter.metrics
      : [
          emptyMetric('Patients in clinic'),
          emptyMetric('Appointments today'),
          emptyMetric('Collected this month', 'currency'),
          emptyMetric('Active treatment plans'),
          emptyMetric('Lab cases in progress'),
        ]
  const commandCenterNotes =
    data.commandCenter?.notes?.length
      ? data.commandCenter.notes
      : ['ERP operating signals will appear here once live clinic activity is available.']

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-[#dce7f5] bg-[radial-gradient(circle_at_top_left,_rgba(7,105,231,0.18),_transparent_48%),linear-gradient(135deg,#10233f,#173766)] text-white shadow-[0_18px_48px_rgba(16,35,63,0.18)]">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
                <BrainCircuit className="h-4 w-4" />
                ERP command center
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em]">
                Every core clinic module, aligned to one operating view
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                Patient registration, scheduling, treatment, billing, lab, reporting and finance
                share one data spine. This layer exposes the work that needs attention first.
              </p>
            </div>
            <Badge className="w-fit border-white/15 bg-white/10 px-3 py-1.5 text-white hover:bg-white/10">
              {data.currency} · {data.timezone}
            </Badge>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-5">
            {commandCenterMetrics.map((metricItem) => (
              <OverviewMetric
                key={metricItem.label}
                metric={metricItem}
                currency={data.currency}
                className="border-white/10 bg-white"
              />
            ))}
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {commandCenterNotes.map((note) => (
              <div key={note} className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm">
                {note}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(moduleBlueprints) as ModuleKey[]).map((moduleId) => {
          const moduleConfig = moduleBlueprints[moduleId]
          const snapshot = data.modules?.[moduleId] || getDefaultModuleSnapshot(moduleId)
          const Icon = moduleConfig.icon

          return (
            <Card
              key={moduleId}
              className="h-full rounded-[28px] border-[#e2eaf5] bg-white shadow-[0_12px_34px_rgba(31,60,102,0.055)]"
            >
              <CardHeader className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className={cn('rounded-2xl p-3', moduleConfig.tone)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-xl tracking-[-0.03em]">{moduleConfig.title}</CardTitle>
                    <CardDescription className="mt-1 text-sm leading-6">
                      {moduleConfig.description}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {moduleConfig.workflow.map((item) => (
                    <Badge key={item} variant="secondary" className="rounded-full px-3 py-1">
                      {item}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  {snapshot.metrics.map((metricItem) => (
                    <div key={metricItem.label} className="rounded-2xl bg-[#f6f9fd] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        {metricItem.label}
                      </p>
                      <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#13233a]">
                        {formatMetric(metricItem, data.currency)}
                      </p>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="space-y-2">
                  {snapshot.alerts.map((alert) => (
                    <div key={alert} className="text-sm leading-6 text-slate-600">
                      {alert}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {moduleConfig.actions.map((action) => (
                    <Button key={action.href} asChild variant="outline" className="rounded-full">
                      <Link href={action.href}>{action.label}</Link>
                    </Button>
                  ))}
                  <Button asChild className="rounded-full">
                    <Link href={moduleConfig.href}>
                      Open module <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export function ErpModuleOverview({
  moduleId,
  eyebrow,
  title,
  description,
  compact = false,
  showActions = true,
}: {
  moduleId: ModuleKey
  eyebrow?: string
  title?: string
  description?: string
  compact?: boolean
  showActions?: boolean
}) {
  const { data, loading, error } = useErpSummary()
  const moduleConfig = moduleBlueprints[moduleId]
  const Icon = moduleConfig.icon

  if (loading) {
    return (
      <Card className="overflow-hidden border-[#dce7f5]">
        <CardContent className={compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8'}>
          <div className="space-y-4">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-4 w-full max-w-2xl" />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className={compact ? 'h-24 rounded-2xl' : 'h-28 rounded-2xl'} />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) return null

  const snapshot = data.modules?.[moduleId] || getDefaultModuleSnapshot(moduleId)

  return (
    <Card className="overflow-hidden border-[#dce7f5] bg-[radial-gradient(circle_at_top_left,_rgba(7,105,231,0.14),_transparent_46%),linear-gradient(180deg,#ffffff,#f8fbff)] shadow-[0_12px_34px_rgba(31,60,102,0.055)]">
      <CardContent className={compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8'}>
        <div
          className={cn(
            'flex flex-col xl:flex-row xl:items-start xl:justify-between',
            compact ? 'gap-4' : 'gap-6'
          )}
        >
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#0769e7]">
              <div className={cn('rounded-xl p-2', moduleConfig.tone)}>
                <Icon className="h-4 w-4" />
              </div>
              {eyebrow || 'ERP workflow'}
            </div>
            <h2
              className={cn(
                'mt-4 font-semibold tracking-[-0.045em] text-[#13233a]',
                compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'
              )}
            >
              {title || moduleConfig.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              {description || moduleConfig.description}
            </p>
            {compact && (
              <div className="mt-4 flex flex-wrap gap-2">
                {moduleConfig.workflow.map((item) => (
                  <Badge key={item} variant="secondary" className="rounded-full px-3 py-1">
                    {item}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {showActions && (
            <div className="flex flex-wrap gap-2">
              {moduleConfig.actions.map((action) => (
                <Button key={action.href} asChild variant="outline" className="rounded-full">
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className={cn('grid gap-4 md:grid-cols-3', compact ? 'mt-5' : 'mt-7')}>
          {snapshot.metrics.map((metricItem) => (
            <OverviewMetric
              key={metricItem.label}
              metric={metricItem}
              currency={data.currency}
              className={compact ? 'p-3.5' : undefined}
            />
          ))}
        </div>

        {compact ? (
          <div className="mt-4 rounded-[24px] border border-[#e3ebf6] bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Operational signals
            </p>
            <div className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
              {snapshot.alerts.slice(0, 2).map((alert) => (
                <div key={alert}>{alert}</div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-7 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-[24px] border border-[#e3ebf6] bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Workflow coverage
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {moduleConfig.workflow.map((item) => (
                  <Badge key={item} variant="secondary" className="rounded-full px-3 py-1">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] border border-[#e3ebf6] bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Operational signals
              </p>
              <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                {snapshot.alerts.map((alert) => (
                  <div key={alert}>{alert}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
