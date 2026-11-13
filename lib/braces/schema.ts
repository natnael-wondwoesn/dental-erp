import { z } from 'zod'

// ---- Option lists (values are stored; labels are derived in the UI) ----
export const FINDINGS = ['CROWDING', 'SPACING', 'OVERBITE', 'UNDERBITE', 'CROSSBITE'] as const
export const SEVERITIES = ['MILD', 'MODERATE', 'SEVERE'] as const
export const FACIAL_PROFILES = ['STRAIGHT', 'CONVEX', 'CONCAVE'] as const
export const SKELETAL_CLASSES = ['CLASS_I', 'CLASS_II', 'CLASS_III', 'NOT_ASSESSED'] as const
export const OCCLUSION_CLASSES = ['CLASS_I', 'CLASS_II', 'CLASS_III'] as const
export const CROSSBITE_TYPES = ['ANTERIOR', 'POSTERIOR', 'UNILATERAL', 'BILATERAL'] as const
export const ORAL_HABITS = [
  'THUMB_SUCKING',
  'TONGUE_THRUSTING',
  'MOUTH_BREATHING',
  'NAIL_BITING',
  'LIP_BITING',
  'BRUXISM',
] as const

// 'METAL' is the original value and stays valid for existing records.
export const BRACES_TYPES = [
  'CONVENTIONAL_METAL',
  'CERAMIC',
  'SELF_LIGATING_METAL',
  'SELF_LIGATING_CERAMIC',
  'LINGUAL',
  'CLEAR_ALIGNERS',
  'OTHER',
  'METAL',
] as const
export const PLAN_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
  'IN_PROGRESS',
] as const
export const PROCEDURE_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED'] as const
export const STAGE_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'] as const
export const VISIT_TYPES = [
  'INITIAL_CONSULTATION',
  'BRACES_INSTALLATION',
  'ADJUSTMENT',
  'WIRE_CHANGE',
  'BRACKET_REPLACEMENT',
  'EMERGENCY',
  'PROGRESS_REVIEW',
  'BRACES_REMOVAL',
  'RETENTION_FOLLOW_UP',
  'OTHER',
  'REVIEW',
] as const
export const VISIT_STATUSES = ['SCHEDULED', 'COMPLETED', 'MISSED', 'CANCELLED'] as const
export const RETAINER_TYPES = ['HAWLEY', 'ESSIX', 'FIXED', 'OTHER', 'REMOVABLE'] as const
export const RETAINER_CONDITIONS = ['GOOD', 'DAMAGED', 'LOST', 'NEEDS_REPLACEMENT'] as const
export const RETAINER_WEAR = ['FULL_TIME', 'NIGHT_TIME', "DOCTOR'S_INSTRUCTIONS"] as const
export const WIRE_ARCHES = ['UPPER', 'LOWER', 'BOTH'] as const
export const WIRE_TYPES = ['NITI', 'STAINLESS_STEEL', 'OTHER'] as const
export const WIRE_ACTIONS = ['INSTALLED', 'CHANGED', 'REMOVED', 'ADJUSTED'] as const

export const MEDIA_KINDS = ['PHOTO', 'XRAY'] as const
export const PHOTO_CATEGORIES = [
  'EXTRAORAL_FRONTAL_REST',
  'EXTRAORAL_FRONTAL_SMILING',
  'EXTRAORAL_RIGHT_PROFILE',
  'EXTRAORAL_LEFT_PROFILE',
  'INTRAORAL_FRONTAL_BITE',
  'INTRAORAL_RIGHT_BUCCAL',
  'INTRAORAL_LEFT_BUCCAL',
  'INTRAORAL_UPPER_OCCLUSAL',
  'INTRAORAL_LOWER_OCCLUSAL',
] as const
export const XRAY_CATEGORIES = [
  'OPG',
  'LATERAL_CEPHALOMETRIC',
  'PA_CEPHALOMETRIC',
  'CBCT',
  'PERIAPICAL',
  'BITEWING',
  'OTHER',
] as const
export const MEDIA_STAGES = [
  'INITIAL_ASSESSMENT',
  'BEFORE_BRACES',
  'DURING_TREATMENT',
  'PROGRESS_REVIEW',
  'AFTER_REMOVAL',
  'RETENTION',
] as const

const text = z.string().max(20_000).nullish()
const date = z
  .string()
  .max(40)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date')
const optionalDate = date.nullish().or(z.literal(''))
const mm = z.coerce.number().min(-100).max(100).nullish().or(z.literal(''))
const choice = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).nullish().or(z.literal(''))

export const stageSchema = z.object({
  name: z.string().max(200),
  description: z.string().max(2_000).default(''),
  expectedStart: optionalDate,
  expectedCompletion: optionalDate,
  status: z.enum(STAGE_STATUSES).default('PLANNED'),
  notes: z.string().max(5_000).default(''),
  // legacy fields from the first version of the module
  procedure: z.string().max(2_000).default(''),
  expectedDate: optionalDate,
})

export const procedureSchema = z.object({
  name: z.string().min(1).max(300),
  description: z.string().max(2_000).default(''),
  plannedDate: optionalDate,
  status: z.enum(PROCEDURE_STATUSES).default('PENDING'),
  notes: z.string().max(5_000).default(''),
})

export const bracesCaseSchema = z.object({
  // legacy assessment fields (the dated assessments live in BracesAssessment)
  chiefComplaint: text,
  findings: z.array(z.enum(FINDINGS)).max(FINDINGS.length).default([]),
  severity: z.enum(SEVERITIES).nullish().or(z.literal('')),
  clinicalDiagnosis: text,
  assessmentNotes: text,
  recordsNotes: text,
  bracesType: z.enum(BRACES_TYPES).nullish().or(z.literal('')),
  customBracesType: z.string().max(120).nullish(),
  objectives: text,
  plannedProcedures: z.array(z.string().min(1).max(500)).max(100).default([]),
  procedureList: z.array(procedureSchema).max(100).default([]),
  stages: z.array(stageSchema).max(100).default([]),
  treatmentStartDate: optionalDate,
  estimatedCompletionDate: optionalDate,
  estimatedMonths: z.coerce.number().int().min(0).max(240).nullish().or(z.literal('')),
  estimatedCost: z.coerce.number().min(0).max(1e10).nullish().or(z.literal('')),
  planNotes: text,
  planStatus: z.enum(PLAN_STATUSES).default('DRAFT'),
  removalDate: optionalDate,
  retainerType: z.enum(RETAINER_TYPES).nullish().or(z.literal('')),
  retainerInstructions: text,
  upperRetainer: z.string().max(200).nullish(),
  lowerRetainer: z.string().max(200).nullish(),
  retainerDeliveryDate: optionalDate,
  retainerWear: z.string().max(60).nullish(),
  retainerCondition: choice(RETAINER_CONDITIONS),
  retentionFollowUps: z.array(date).max(50).default([]),
  retentionNotes: text,
})

export const wireSchema = z.object({
  arch: z.enum(WIRE_ARCHES),
  wireType: z.enum(WIRE_TYPES).nullish().or(z.literal('')),
  wireSize: z.string().max(40).default(''),
  action: z.enum(WIRE_ACTIONS),
  notes: z.string().max(2_000).default(''),
})

export const bracesVisitSchema = z.object({
  visitDate: date,
  visitType: z.enum(VISIT_TYPES),
  status: choice(VISIT_STATUSES),
  currentStage: z.string().max(200).nullish(),
  wireAdjustments: text,
  applianceChanges: text,
  clinicalProgress: text,
  patientConcerns: text,
  clinicalFindings: text,
  progressSinceLast: text,
  objectivesAchieved: text,
  remainingObjectives: text,
  complications: text,
  modifications: text,
  recommendations: text,
  proceduresPerformed: z.array(z.string().min(1).max(300)).max(50).default([]),
  wires: z.array(wireSchema).max(6).default([]),
  invoiceId: z.string().max(40).nullish().or(z.literal('')),
  nextAppointment: optionalDate,
  doctorId: z.string().max(40).nullish().or(z.literal('')),
})

export const bracesAssessmentSchema = z.object({
  assessedAt: date,
  doctorId: z.string().max(40).nullish().or(z.literal('')),
  chiefComplaint: text,
  clinicalDiagnosis: text,
  severity: choice(SEVERITIES),
  dentalHistory: text,
  medicalHistory: text,
  facialProfile: choice(FACIAL_PROFILES),
  skeletalClass: choice(SKELETAL_CLASSES),
  molarRight: choice(OCCLUSION_CLASSES),
  molarLeft: choice(OCCLUSION_CLASSES),
  canineRight: choice(OCCLUSION_CLASSES),
  canineLeft: choice(OCCLUSION_CLASSES),
  crossbite: z.array(z.enum(CROSSBITE_TYPES)).max(CROSSBITE_TYPES.length).default([]),
  oralHabits: z.array(z.enum(ORAL_HABITS)).max(ORAL_HABITS.length).default([]),
  findings: z.array(z.enum(FINDINGS)).max(FINDINGS.length).default([]),
  overjetMm: mm,
  overbiteMm: mm,
  overbitePercent: mm,
  midlineUpperMm: mm,
  midlineLowerMm: mm,
  crowdingUpperMm: mm,
  crowdingLowerMm: mm,
  spacingUpperMm: mm,
  spacingLowerMm: mm,
  notes: text,
})

export const bracesMediaSchema = z.object({
  documentId: z.string().min(1).max(40),
  kind: z.enum(MEDIA_KINDS),
  category: z.string().min(1).max(60),
  stage: choice(MEDIA_STAGES),
  capturedAt: date,
  interpretation: text,
  notes: text,
})

export const retentionCheckSchema = z.object({
  checkDate: date,
  retainerCondition: choice(RETAINER_CONDITIONS),
  compliance: z.string().max(120).nullish(),
  relapse: z.string().max(2_000).nullish(),
  notes: text,
  doctorId: z.string().max(40).nullish().or(z.literal('')),
})

export type BracesCaseInput = z.infer<typeof bracesCaseSchema>
export type BracesVisitInput = z.infer<typeof bracesVisitSchema>
export type BracesAssessmentInput = z.infer<typeof bracesAssessmentSchema>
export type BracesMediaInput = z.infer<typeof bracesMediaSchema>
export type RetentionCheckInput = z.infer<typeof retentionCheckSchema>

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
    customBracesType: blank(input.customBracesType),
    objectives: blank(input.objectives),
    plannedProcedures: input.plannedProcedures,
    procedureList: input.procedureList.map((p) => ({ ...p, plannedDate: p.plannedDate || '' })),
    stages: input.stages.map((stage) => ({
      ...stage,
      expectedDate: stage.expectedDate || '',
      expectedStart: stage.expectedStart || '',
      expectedCompletion: stage.expectedCompletion || '',
    })),
    treatmentStartDate: toDate(input.treatmentStartDate),
    estimatedCompletionDate: toDate(input.estimatedCompletionDate),
    estimatedMonths: blank(input.estimatedMonths),
    estimatedCost: blank(input.estimatedCost),
    planNotes: blank(input.planNotes),
    planStatus: input.planStatus,
    removalDate: toDate(input.removalDate),
    retainerType: blank(input.retainerType),
    retainerInstructions: blank(input.retainerInstructions),
    upperRetainer: blank(input.upperRetainer),
    lowerRetainer: blank(input.lowerRetainer),
    retainerDeliveryDate: toDate(input.retainerDeliveryDate),
    retainerWear: blank(input.retainerWear),
    retainerCondition: blank(input.retainerCondition),
    retentionFollowUps: input.retentionFollowUps,
    retentionNotes: blank(input.retentionNotes),
  }
}

export function visitData(input: BracesVisitInput) {
  return {
    visitDate: new Date(input.visitDate),
    visitType: input.visitType,
    status: blank(input.status),
    currentStage: blank(input.currentStage),
    wireAdjustments: blank(input.wireAdjustments),
    applianceChanges: blank(input.applianceChanges),
    clinicalProgress: blank(input.clinicalProgress),
    patientConcerns: blank(input.patientConcerns),
    clinicalFindings: blank(input.clinicalFindings),
    progressSinceLast: blank(input.progressSinceLast),
    objectivesAchieved: blank(input.objectivesAchieved),
    remainingObjectives: blank(input.remainingObjectives),
    complications: blank(input.complications),
    modifications: blank(input.modifications),
    recommendations: blank(input.recommendations),
    proceduresPerformed: input.proceduresPerformed,
    wires: input.wires,
    invoiceId: blank(input.invoiceId),
    nextAppointment: toDate(input.nextAppointment),
    doctorId: blank(input.doctorId),
  }
}

export function assessmentData(input: BracesAssessmentInput) {
  return {
    assessedAt: new Date(input.assessedAt),
    doctorId: blank(input.doctorId),
    chiefComplaint: blank(input.chiefComplaint),
    clinicalDiagnosis: blank(input.clinicalDiagnosis),
    severity: blank(input.severity),
    dentalHistory: blank(input.dentalHistory),
    medicalHistory: blank(input.medicalHistory),
    facialProfile: blank(input.facialProfile),
    skeletalClass: blank(input.skeletalClass),
    molarRight: blank(input.molarRight),
    molarLeft: blank(input.molarLeft),
    canineRight: blank(input.canineRight),
    canineLeft: blank(input.canineLeft),
    crossbite: input.crossbite,
    oralHabits: input.oralHabits,
    findings: input.findings,
    overjetMm: blank(input.overjetMm),
    overbiteMm: blank(input.overbiteMm),
    overbitePercent: blank(input.overbitePercent),
    midlineUpperMm: blank(input.midlineUpperMm),
    midlineLowerMm: blank(input.midlineLowerMm),
    crowdingUpperMm: blank(input.crowdingUpperMm),
    crowdingLowerMm: blank(input.crowdingLowerMm),
    spacingUpperMm: blank(input.spacingUpperMm),
    spacingLowerMm: blank(input.spacingLowerMm),
    notes: blank(input.notes),
  }
}

export function mediaData(input: BracesMediaInput) {
  return {
    documentId: input.documentId,
    kind: input.kind,
    category: input.category,
    stage: blank(input.stage),
    capturedAt: new Date(input.capturedAt),
    interpretation: blank(input.interpretation),
    notes: blank(input.notes),
  }
}

export function retentionCheckData(input: RetentionCheckInput) {
  return {
    checkDate: new Date(input.checkDate),
    retainerCondition: blank(input.retainerCondition),
    compliance: blank(input.compliance),
    relapse: blank(input.relapse),
    notes: blank(input.notes),
    doctorId: blank(input.doctorId),
  }
}

/** Calendar date in the viewer's own timezone (never UTC), so "today" is today for the clinic. */
export function localToday(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export const labelOf = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
