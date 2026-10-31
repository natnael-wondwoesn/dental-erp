import { z } from 'zod'

export const FINDINGS = ['CROWDING', 'SPACING', 'OVERBITE', 'UNDERBITE', 'CROSSBITE'] as const
export const SEVERITIES = ['MILD', 'MODERATE', 'SEVERE'] as const
export const BRACES_TYPES = ['METAL', 'CERAMIC', 'OTHER'] as const
export const PLAN_STATUSES = ['DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED'] as const
export const STAGE_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'] as const
export const VISIT_TYPES = ['ADJUSTMENT', 'REVIEW', 'EMERGENCY'] as const
export const RETAINER_TYPES = ['FIXED', 'REMOVABLE', 'OTHER'] as const

const text = z.string().max(20_000).nullish()
const date = z
  .string()
  .max(40)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date')
const optionalDate = date.nullish().or(z.literal(''))

export const stageSchema = z.object({
  name: z.string().max(200),
  procedure: z.string().max(2_000).default(''),
  expectedDate: optionalDate,
  status: z.enum(STAGE_STATUSES).default('PLANNED'),
  notes: z.string().max(5_000).default(''),
})

export const bracesCaseSchema = z.object({
  chiefComplaint: text,
  findings: z.array(z.enum(FINDINGS)).max(FINDINGS.length).default([]),
  severity: z.enum(SEVERITIES).nullish().or(z.literal('')),
  clinicalDiagnosis: text,
  assessmentNotes: text,
  recordsNotes: text,
  bracesType: z.enum(BRACES_TYPES).nullish().or(z.literal('')),
  objectives: text,
  plannedProcedures: z.array(z.string().min(1).max(500)).max(100).default([]),
  stages: z.array(stageSchema).max(100).default([]),
  estimatedMonths: z.coerce.number().int().min(0).max(240).nullish().or(z.literal('')),
  estimatedCost: z.coerce.number().min(0).max(1e10).nullish().or(z.literal('')),
  planNotes: text,
  planStatus: z.enum(PLAN_STATUSES).default('DRAFT'),
  removalDate: optionalDate,
  retainerType: z.enum(RETAINER_TYPES).nullish().or(z.literal('')),
  retainerInstructions: text,
  retentionFollowUps: z.array(date).max(50).default([]),
  retentionNotes: text,
})

export const bracesVisitSchema = z.object({
  visitDate: date,
  visitType: z.enum(VISIT_TYPES),
  wireAdjustments: text,
  applianceChanges: text,
  clinicalProgress: text,
  patientConcerns: text,
  nextAppointment: optionalDate,
  doctorId: z.string().max(40).nullish().or(z.literal('')),
})

export type BracesCaseInput = z.infer<typeof bracesCaseSchema>
export type BracesVisitInput = z.infer<typeof bracesVisitSchema>

const blank = <T>(value: T | '' | null | undefined) =>
  value === '' || value == null ? null : value
const toDate = (value: string | null | undefined) => (value ? new Date(value) : null)

export function caseData(input: BracesCaseInput) {
  return {
    chiefComplaint: blank(input.chiefComplaint),
    findings: input.findings,
    severity: blank(input.severity),
    clinicalDiagnosis: blank(input.clinicalDiagnosis),
    assessmentNotes: blank(input.assessmentNotes),
    recordsNotes: blank(input.recordsNotes),
    bracesType: blank(input.bracesType),
    objectives: blank(input.objectives),
    plannedProcedures: input.plannedProcedures,
    stages: input.stages.map((stage) => ({ ...stage, expectedDate: stage.expectedDate || '' })),
    estimatedMonths: blank(input.estimatedMonths),
    estimatedCost: blank(input.estimatedCost),
    planNotes: blank(input.planNotes),
    planStatus: input.planStatus,
    removalDate: toDate(input.removalDate),
    retainerType: blank(input.retainerType),
    retainerInstructions: blank(input.retainerInstructions),
    retentionFollowUps: input.retentionFollowUps,
    retentionNotes: blank(input.retentionNotes),
  }
}

export function visitData(input: BracesVisitInput) {
  return {
    visitDate: new Date(input.visitDate),
    visitType: input.visitType,
    wireAdjustments: blank(input.wireAdjustments),
    applianceChanges: blank(input.applianceChanges),
    clinicalProgress: blank(input.clinicalProgress),
    patientConcerns: blank(input.patientConcerns),
    nextAppointment: toDate(input.nextAppointment),
    doctorId: blank(input.doctorId),
  }
}
