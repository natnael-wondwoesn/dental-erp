import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { GatewaySettings } from '@/components/billing/gateway-settings'
it('does not offer unsupported Indian payment providers for ETB clinics', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  vi.stubGlobal('fetch', fetcher)
  render(<GatewaySettings />)
  expect(
    await screen.findByText(/Online payment collection is not configured for ETB/)
  ).toBeInTheDocument()
  expect(fetcher).not.toHaveBeenCalled()
  expect(screen.queryByText(/Razorpay, PhonePe/)).not.toBeInTheDocument()
})
