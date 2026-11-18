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
  annotations?: AnnotationSet | null
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

export type Pt = { x: number; y: number }
export type AnnotationType = 'line' | 'distance' | 'angle' | 'point' | 'arrow' | 'marker' | 'text'
/** Points are in the image's own pixel coordinates, so drawings stay put when zooming or rotating. */
export type Annotation = {
  id: string
  type: AnnotationType
  points: Pt[]
  text?: string
  n?: number
}
export type AnnotationSet = { items: Annotation[]; mmPerPx?: number | null }
export const EMPTY_ANNOTATIONS: AnnotationSet = { items: [], mmPerPx: null }

export const lengthPx = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y)
/** Angle at the middle point, in degrees. Needs no scale, so it is always exact. */
export function angleDeg(a: Pt, v: Pt, b: Pt) {
  const d =
    Math.abs(Math.atan2(b.y - v.y, b.x - v.x) - Math.atan2(a.y - v.y, a.x - v.x)) * (180 / Math.PI)
  return d > 180 ? 360 - d : d
}
/** Distances are shown in mm only when the image has a known scale; otherwise in pixels, clearly marked. */
export function formatDistance(px: number, mmPerPx?: number | null) {
  return mmPerPx ? `${(px * mmPerPx).toFixed(1)} mm` : `${Math.round(px)} px (not calibrated)`
}
