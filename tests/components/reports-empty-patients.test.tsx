import { render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import ReportsPage from '@/app/(dashboard)/reports/page'
import { LanguageProvider } from '@/lib/i18n'
vi.mock('@/components/dashboard/erp-overview', () => ({ ErpModuleOverview: () => null }))
vi.mock('@/components/ai/report-builder', () => ({ ReportBuilder: () => null }))
vi.mock('recharts', () =>
  Object.fromEntries(
    [
      'LineChart',
      'Line',
      'BarChart',
      'Bar',
      'PieChart',
      'Pie',
      'Cell',
      'XAxis',
      'YAxis',
      'CartesianGrid',
      'Tooltip',
      'Legend',
      'ResponsiveContainer',
      'ComposedChart',
      'Area',
    ].map((k) => [k, () => null])
  )
)
it('renders finite patient shares for an empty clinic', async () => {
  const patients = {
    newPatients: 0,
    returningPatients: 0,
    totalPatients: 0,
    retentionRate: 0,
    demographics: { male: 0, female: 0, other: 0 },
    ageGroups: [],
    acquisitionSources: [],
    trends: [],
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => patients }))
  const { container } = render(
    <LanguageProvider>
      <ReportsPage />
    </LanguageProvider>
  )
  await waitFor(() => expect(screen.getAllByText(/of total/)).toHaveLength(2))
  expect(container.textContent).not.toContain('NaN')
  expect(container.textContent).not.toContain('Infinity')
  expect(screen.getAllByText(/0.0% of total/)).toHaveLength(2)
})
