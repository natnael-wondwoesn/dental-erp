import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ErpCommandCenter, ErpModuleOverview } from '@/components/dashboard/erp-overview'
import { LanguageProvider } from '@/lib/i18n'

function renderWithLanguage(ui: React.ReactNode) {
  return render(<LanguageProvider>{ui}</LanguageProvider>)
}

const summary = {
  currency: 'ETB',
  timezone: 'Africa/Addis_Ababa',
  generatedAt: '2026-08-17T00:00:00.000Z',
  commandCenter: {
    metrics: [
      { label: 'Patients in clinic', value: 1, kind: 'number' },
      { label: 'Appointments today', value: 5, kind: 'number' },
    ],
    notes: ['One patient is waiting.'],
  },
  modules: {
    patients: {
      metrics: [
        { label: 'Total patients', value: 10, kind: 'number' },
        { label: 'New this month', value: 3, kind: 'number' },
        { label: 'Patients with balances', value: 1, kind: 'number' },
      ],
      alerts: ['One patient has an open balance.'],
    },
  },
}

describe('ERP overview responsive density', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => summary }))
  })

  it('keeps a module overview compact on the first mobile viewport', async () => {
    renderWithLanguage(
      <ErpModuleOverview
        moduleId="patients"
        title="Patient records for intake, follow-up, and longitudinal history"
        description="Patient workflow context"
        compact
        showActions={false}
      />
    )

    const title = await screen.findByRole('heading', {
      name: 'Patient records for intake, follow-up, and longitudinal history',
    })
    expect(title).toHaveClass('text-xl')
    expect(screen.getByText('Patient workflow context')).toHaveClass('hidden', 'sm:block')

    const metrics = screen.getByTestId('erp-module-metrics')
    expect(metrics).toHaveClass('grid-cols-3')
    expect(screen.getByText('Operational signals').parentElement).toHaveClass('hidden', 'sm:block')
  })

  it('does not render the full command-center catalogue on mobile', async () => {
    renderWithLanguage(<ErpCommandCenter />)
    await waitFor(() => expect(screen.getByText('ERP command center')).toBeInTheDocument())
    expect(screen.getByTestId('erp-command-center')).toHaveClass('hidden', 'md:block')
  })
})
