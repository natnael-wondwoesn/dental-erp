'use client'

import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'
import { labelOf } from '@/lib/braces/schema'

export type Doctor = { id: string; firstName: string; lastName: string }

/* eslint-disable @typescript-eslint/no-explicit-any */
export type BracesData = {
  id: string
  planStatus: string
  bracesType: string | null
  customBracesType: string | null
  treatmentStartDate: string | null
  estimatedCompletionDate: string | null
  removalDate: string | null
  createdAt: string
  visits: any[]
  assessments: any[]
  media: any[]
  retentionChecks: any[]
  [key: string]: any
}
export type Billing = { total: number; paid: number; balance: number }
export type PatientInfo = {
  id: string
  patientId?: string
  firstName: string
  lastName: string
  phone?: string
  dateOfBirth?: string | null
  age?: number | null
}

export type WorkspaceCtx = {
  patientId: string
  patient: PatientInfo | null
  data: BracesData | null
  billing: Billing | null
  doctors: Doctor[]
  reload: () => Promise<void>
  go: (tab: string) => void
}

export const day = (value?: string | null) => (value ? String(value).slice(0, 10) : '')
export const showDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : '-'
export const money = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
export const doctorName = (d?: { firstName: string; lastName: string } | null) =>
  d ? `Dr. ${d.firstName} ${d.lastName}` : ''

export function ageFrom(patient: PatientInfo | null) {
  if (!patient) return null
  if (patient.dateOfBirth) {
    const dob = new Date(patient.dateOfBirth)
    const now = new Date()
    let age = now.getFullYear() - dob.getFullYear()
    const m = now.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1
    return age
  }
  return patient.age ?? null
}

export function Pick({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  id,
}: {
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  placeholder?: string
  id?: string
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {labelOf(option)}
        </option>
      ))}
    </select>
  )
}

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string
  children: ReactNode
  hint?: string
  className?: string
}) {
  return (
    <div className={className}>
      <Label className="mb-1 block">{label}</Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function Chips({
  options,
  value,
  onChange,
}: {
  options: readonly string[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = value.includes(option)
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(on ? value.filter((v) => v !== option) : [...value, option])}
            className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'}`}
          >
            {labelOf(option)}
          </button>
        )
      })}
    </div>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

/** Open a print window with a plain, clinic-neutral report. All values are escaped. */
export function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
export function printReport(title: string, body: string) {
  const w = window.open('', '_blank', 'noopener,width=900,height=1000')
  if (!w) return false
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font:14px/1.5 Arial,sans-serif;margin:32px;color:#111}h1{font-size:22px;margin:0 0 4px}
    h2{font-size:15px;margin:22px 0 6px;border-bottom:1px solid #999;padding-bottom:3px}
    table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:5px 8px;text-align:left;vertical-align:top}
    th{background:#f2f2f2;width:34%}.muted{color:#555}.sig{margin-top:48px;display:flex;gap:60px}
    .sig div{border-top:1px solid #000;padding-top:4px;min-width:200px}@media print{body{margin:14mm}}
    </style></head><body>${body}</body></html>`
  )
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
  return true
}

/** Body for PUT /braces: the saved case as it is, with only the given fields replaced. */
export function casePayload(data: BracesData, overrides: Record<string, unknown>) {
  return {
    ...data,
    plannedProcedures: data.plannedProcedures ?? [],
    findings: data.findings ?? [],
    procedureList: data.procedureList ?? [],
    stages: data.stages ?? [],
    retentionFollowUps: (data.retentionFollowUps ?? []).map(day),
    removalDate: day(data.removalDate),
    treatmentStartDate: day(data.treatmentStartDate),
    estimatedCompletionDate: day(data.estimatedCompletionDate),
    retainerDeliveryDate: day(data.retainerDeliveryDate),
    ...overrides,
  }
}
