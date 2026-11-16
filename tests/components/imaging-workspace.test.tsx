import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { ImagingWorkspace } from '@/components/imaging/imaging-workspace'
import { applyFilters, emptyFilters } from '@/components/imaging/image-library'
import { validateFile } from '@/components/imaging/upload-dialog'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const media = (id: string, over: object) => ({
  id,
  documentId: `d-${id}`,
  kind: 'PHOTO',
  category: 'INTRAORAL_FRONTAL_BITE',
  stage: 'BEFORE_BRACES',
  title: null,
  capturedAt: '2026-08-20T00:00:00.000Z',
  createdAt: '2026-08-21T00:00:00.000Z',
  notes: null,
  interpretation: null,
  relatedVisitId: null,
  uploadedById: 'u1',
  document: { fileType: 'image/jpeg', originalName: 'a.jpg' },
  ...over,
})
const items = [
  media('m1', { title: 'Frontal bite start' }),
  media('m2', {
    category: 'OPG',
    kind: 'XRAY',
    stage: 'DURING_TREATMENT',
    capturedAt: '2026-10-01T00:00:00.000Z',
    title: 'Panoramic',
  }),
  media('m3', {
    category: 'EXTRAORAL_RIGHT_PROFILE',
    stage: 'RETENTION',
    capturedAt: '2026-11-01T00:00:00.000Z',
  }),
  media('m4', { document: { fileType: 'application/pdf', originalName: 'report.pdf' } }),
]

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const json = (body: unknown) => ({ ok: true, json: async () => body })
      if (url.endsWith('/braces'))
        return json({
          bracesCase: {
            planStatus: 'ACTIVE',
            bracesType: 'CERAMIC',
            media: items,
            visits: [{ id: 'v1', visitDate: '2026-09-01T00:00:00.000Z', visitType: 'ADJUSTMENT' }],
            assessments: [],
          },
        })
      if (url.includes('/history'))
        return json({
          history: [
            { id: 'h1', label: 'Image uploaded', at: '2026-08-21T00:00:00.000Z', by: 'Dr A' },
          ],
        })
      return json({
        patient: { id: 'p1', firstName: 'Sara', lastName: 'K', patientId: 'P-1', age: 14 },
      })
    })
  )
})
afterEach(() => vi.unstubAllGlobals())

it('shows the patient header, the library and the viewer, and filters the library', async () => {
  render(<ImagingWorkspace patientId="p1" />)
  expect(await screen.findByText('Sara K')).toBeInTheDocument()
  expect(screen.getByText('ID: P-1')).toBeInTheDocument()
  expect(screen.getByText('Age: 14 years')).toBeInTheDocument()
  expect(screen.getByText('Orthodontic imaging')).toBeInTheDocument()
  // newest first, non-image files are not shown in the library
  expect(screen.getByText('1 of 3', { exact: false })).toBeInTheDocument()
  expect(screen.getByLabelText('Zoom in')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Radiographs' }))
  await waitFor(() => expect(screen.getByText('1 of 1', { exact: false })).toBeInTheDocument())
  expect(screen.getAllByText('Panoramic').length).toBeGreaterThan(0)
})

it('opens the upload dialog', async () => {
  render(<ImagingWorkspace patientId="p1" />)
  await screen.findByText('Sara K')
  fireEvent.click(screen.getByRole('button', { name: /Upload images/ }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('Browse files')).toBeInTheDocument()
})

it('maps the stage filters onto the stored stages and ignores non-images', () => {
  const list = items as never[]
  expect(applyFilters(list, { ...emptyFilters, stage: 'INITIAL' }).map((m: any) => m.id)).toEqual([
    'm1',
  ])
  expect(applyFilters(list, { ...emptyFilters, stage: 'RETENTION' }).map((m: any) => m.id)).toEqual(
    ['m3']
  )
  expect(applyFilters(list, emptyFilters).map((m: any) => m.id)).not.toContain('m4')
  expect(applyFilters(list, { ...emptyFilters, from: '2026-10-15' }).map((m: any) => m.id)).toEqual(
    ['m3']
  )
})

it('accepts JPG, PNG and WebP up to 10 MB and rejects the rest with a clear reason', () => {
  expect(validateFile({ name: 'a.jpg', type: 'image/jpeg', size: 1000 })).toBeNull()
  expect(validateFile({ name: 'a.webp', type: 'image/webp', size: 1000 })).toBeNull()
  expect(validateFile({ name: 'a.dcm', type: 'application/dicom', size: 1000 })).toMatch(
    /JPG, PNG or WebP/
  )
  expect(validateFile({ name: 'a.png', type: 'image/png', size: 11 * 1024 * 1024 })).toMatch(
    /10 MB/
  )
})
