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
        patient: {
          id: 'p1',
          firstName: 'Sara',
          lastName: 'K',
          patientId: 'P-1',
          age: 14,
          gender: 'FEMALE',
        },
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

it('is the Orthodontic Department, without the progress-tracking tab', async () => {
  render(<BracesWorkspace patientId="p1" />)
  expect(await screen.findByText(/Orthodontic Department/)).toBeInTheDocument()
  expect(screen.queryByText(/Braces department/)).toBeNull()
  expect(screen.queryByRole('tab', { name: 'Progress tracking' })).toBeNull()
  expect(screen.getByRole('link', { name: 'All orthodontic patients' })).toBeInTheDocument()
})

it('assessment form: sex from the record, medical checklist, Palmer chart, no mm labels', async () => {
  render(<BracesWorkspace patientId="p1" />)
  await screen.findByText('Outstanding balance')
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Assessment' }), { button: 0 })
  await screen.findByText(/New orthodontic assessment/)

  expect(screen.getByDisplayValue('Female')).toBeInTheDocument()
  for (const name of ['Overjet', 'Overbite', 'Upper arch crowding', 'Lower arch spacing'])
    expect(screen.getAllByText(name).length).toBeGreaterThan(0)
  expect(screen.queryByText(/\(mm\)/)).toBeNull()

  expect(screen.getByText('Medical History & Existing Conditions')).toBeInTheDocument()
  expect(screen.queryByText('Conditions, allergies, medications')).toBeNull()
  const box = (name: string) => screen.getByRole('checkbox', { name })
  fireEvent.click(box('Diabetes Type 2'))
  fireEvent.click(box('Hypertension (High Blood Pressure)'))
  expect(box('Diabetes Type 2')).toBeChecked()
  expect(box('Hypertension (High Blood Pressure)')).toBeChecked()

  fireEvent.click(box('None'))
  expect(box('None')).toBeChecked()
  expect(box('Diabetes Type 2')).not.toBeChecked()
  fireEvent.click(box('Pregnancy'))
  expect(box('None')).not.toBeChecked()

  expect(screen.queryByLabelText('Other medical condition')).toBeNull()
  fireEvent.click(box('Other'))
  expect(screen.getByLabelText('Other medical condition')).toBeInTheDocument()

  expect(screen.getByText('Palmer dental chart')).toBeInTheDocument()
  expect(screen.getByText('Upper Right (UR)')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Print \/ Export PDF/ })).toBeInTheDocument()
})

it('sends the chosen conditions, sex and chart with the assessment', async () => {
  render(<BracesWorkspace patientId="p1" />)
  await screen.findByText('Outstanding balance')
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Assessment' }), { button: 0 })
  await screen.findByText(/New orthodontic assessment/)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Asthma / Respiratory Problems' }))
  fireEvent.click(screen.getByRole('button', { name: /Save assessment/ }))
  await waitFor(() => {
    const calls = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls
    const save = calls.find(
      ([url, init]) => url.endsWith('/assessments') && init?.method === 'POST'
    )
    expect(save).toBeTruthy()
    const body = JSON.parse(String(save![1].body))
    expect(body.sex).toBe('FEMALE')
    expect(body.medicalConditions).toEqual(['ASTHMA'])
    expect(body).not.toHaveProperty('medicalHistory')
  })
})
