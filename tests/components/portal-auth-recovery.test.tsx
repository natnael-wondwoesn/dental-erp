import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import PatientDashboard from '@/app/portal/(secure)/page'
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: push }) }))
beforeEach(() => {
  vi.clearAllMocks()
})
it('redirects an expired patient session instead of rendering error JSON as dashboard data', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) })
  )
  render(<PatientDashboard />)
  await waitFor(() => expect(push).toHaveBeenCalledWith('/portal/login'))
  expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
})
it('shows a recoverable error on a failed dashboard response', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Failed to load dashboard' }),
    })
  )
  render(<PatientDashboard />)
  expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to load your portal')
})
