/* eslint-disable @typescript-eslint/no-explicit-any */
export type ImageItem = {
  id: string
  documentId: string
  kind: 'PHOTO' | 'XRAY'
  category: string
  stage: string | null
  title: string | null
  capturedAt: string
  createdAt: string
  notes: string | null
  interpretation: string | null
  relatedVisitId: string | null
  uploadedById: string | null
  document: { fileType: string; originalName: string; fileSize?: number } | null
}

/** The four stage filters of the design map onto the stages already used by the Braces module. */
export const STAGE_FILTERS = [
  ['ALL', 'All', []],
  ['INITIAL', 'Initial', ['INITIAL_ASSESSMENT', 'BEFORE_BRACES']],
  ['DURING', 'During treatment', ['DURING_TREATMENT', 'PROGRESS_REVIEW']],
  ['FINAL', 'Final', ['AFTER_REMOVAL']],
  ['RETENTION', 'Retention', ['RETENTION']],
] as const

export const TYPE_FILTERS = [
  ['ALL', 'All images'],
  ['PHOTO', 'Clinical photos'],
  ['XRAY', 'Radiographs'],
] as const

export const imageUrl = (patientId: string, documentId: string) =>
  `/api/patients/${patientId}/documents/${documentId}?download=true`

export const imageTitle = (m: ImageItem, label: (v: string) => string) =>
  m.title?.trim() || label(m.category)
