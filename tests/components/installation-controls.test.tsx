import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InstallationControls } from '@/components/platform/installation-controls'

const installation = {
  id: 'install-1',
  name: 'Test Clinic ERP',
  hostname: 'clinic.example.et',
  productKey: 'dental-erp',
  status: 'ACTIVE',
}

function response(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response)
}

describe('InstallationControls', () => {
  afterEach(() => vi.restoreAllMocks())

  it('checks database status and loads users automatically', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() =>
        response({ id: 'status-1', status: 'SUCCEEDED', result: { databaseRunning: true } })
      )
      .mockImplementationOnce(() =>
        response({ id: 'users-1', status: 'SUCCEEDED', result: { users: [] } })
      )

    render(<InstallationControls installation={installation} />)

    expect(await screen.findByText(/Database: running/i)).toBeInTheDocument()
    expect(await screen.findByText(/No clinic users found/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('explains prerequisites and enables stop only after reason and hostname', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() =>
        response({ id: 'status-1', status: 'SUCCEEDED', result: { databaseRunning: true } })
      )
      .mockImplementationOnce(() =>
        response({ id: 'users-1', status: 'SUCCEEDED', result: { users: [] } })
      )

    render(<InstallationControls installation={installation} />)
    const stop = screen.getByRole('button', { name: /stop database/i })
    await waitFor(() => expect(stop).toBeDisabled())
    expect(screen.getByText(/Required for every change/i)).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/Explain this change/i), {
      target: { value: 'Client requested maintenance' },
    })
    fireEvent.change(screen.getByLabelText(/To stop, type clinic\.example\.et/i), {
      target: { value: 'clinic.example.et' },
    })

    await waitFor(() => expect(stop).toBeEnabled())
  })

  it('offers owner-only demo seed and reset operations after an audit reason', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() =>
        response({ id: 'status-1', status: 'SUCCEEDED', result: { databaseRunning: true } })
      )
      .mockImplementationOnce(() =>
        response({ id: 'users-1', status: 'SUCCEEDED', result: { users: [] } })
      )

    render(<InstallationControls installation={installation} />)
    const seed = await screen.findByRole('button', { name: /seed demo data/i })
    const reset = screen.getByRole('button', { name: /remove demo data/i })
    expect(seed).toBeDisabled()
    expect(reset).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText(/Explain this change/i), {
      target: { value: 'Client demonstration dataset' },
    })
    await waitFor(() => expect(seed).toBeEnabled())
    expect(reset).toBeEnabled()
    expect(screen.getByText(/clinic records remain untouched/i)).toBeInTheDocument()
  })
})
