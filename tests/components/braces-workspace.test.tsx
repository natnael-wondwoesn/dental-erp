import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { BracesWorkspace } from '@/components/braces/braces-workspace'

vi.mock('@/components/dental-chart', () => ({ DentalChart: () => <div>dental chart</div> }))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const soon = new Date(Date.now() + 5 * 86_400_000).toISOString()
const bracesCase = {
  id: 'c1',
  planStatus: 'ACTIVE',
  bracesType: 'CERAMIC',
  customBracesType: null,
  treatmentStartDate: '2026-09-01T00:00:00.000Z',
  estimatedCompletionDate: null,
  removalDate: null,
  createdAt: '2026-08-20T00:00:00.000Z',
  plannedProcedures: ['Wire adjustment'],
  procedureList: [],
  stages: [],
  findings: [],
  visits: [
    {
      id: 'v1',
      visitDate: '2026-11-01T00:00:00.000Z',
      visitType: 'WIRE_CHANGE',
      status: 'COMPLETED',
      progressSinceLast: 'Alignment improving',
      nextAppointment: soon,
      doctor: { firstName: 'Abiy', lastName: 'T' },
      wires: [],
      proceduresPerformed: [],
    },
  ],
  assessments: [
    {
      id: 'a1',
      assessedAt: '2026-08-20T00:00:00.000Z',
      clinicalDiagnosis: 'Class II',
      overjetMm: '5.0',
      findings: ['CROWDING'],
      crossbite: [],
      oralHabits: [],
    },
  ],
  media: [
    {
      id: 'm1',
      kind: 'PHOTO',
      category: 'INTRAORAL_FRONTAL_BITE',
      stage: 'BEFORE_BRACES',
      capturedAt: '2026-08-20T00:00:00.000Z',
      documentId: 'd1',
      document: { fileType: 'image/jpeg', originalName: 'a.jpg' },
    },
  ],
  retentionChecks: [],
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const json = (body: unknown) => ({ ok: true, json: async () => body })
      if (url.endsWith('/braces')) {
        return json({ bracesCase, billing: { total: 1500, paid: 900, balance: 600 } })
      }
      if (url.includes('/api/staff/doctors'))
        return json([{ id: 'd', firstName: 'Abiy', lastName: 'T' }])
      return json({
        patient: { id: 'p1', firstName: 'Sara', lastName: 'K', patientId: 'P-1', age: 14 },
      })
    })
  )
})
afterEach(() => vi.unstubAllGlobals())

it('shows the case overview with billing and next appointment, and every section opens', async () => {
  render(<BracesWorkspace patientId="p1" />)
  expect((await screen.findAllByText('Sara K', { exact: false })).length).toBeGreaterThan(0)
  expect(await screen.findByText('Outstanding balance')).toBeInTheDocument()
  expect(screen.getByText('600')).toBeInTheDocument()
  expect(screen.getByText('Alignment improving')).toBeInTheDocument()

  const sections: [string, RegExp][] = [
    ['Assessment', /New orthodontic assessment/],
    ['Dental records', /Clinical photographs/],
    ['Treatment plan', /Planned procedures/],
    ['Progress & visits', /Record a visit/],
    ['Progress tracking', /Case timeline/],
    ['Retention', /Braces removal and retainers/],
    ['Documents & forms', /Documents and forms/],
  ]
  for (const [tab, heading] of sections) {
    fireEvent.mouseDown(screen.getByRole('tab', { name: tab }), { button: 0 })
    await waitFor(() => expect(screen.getAllByText(heading).length).toBeGreaterThan(0))
  }
})

it('keeps old plain-text procedures visible in the structured plan', async () => {
  render(<BracesWorkspace patientId="p1" />)
  await screen.findByText('Outstanding balance')
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Treatment plan' }), { button: 0 })
  expect(await screen.findByDisplayValue('Wire adjustment')).toBeInTheDocument()
})
