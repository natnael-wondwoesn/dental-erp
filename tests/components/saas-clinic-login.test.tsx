// @vitest-environment-options {"url":"https://drberhanubelta.dental.clinic-cms.cc/login"}
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import LoginPage from '@/app/(auth)/login/page'

vi.mock('@/lib/api-client', () => ({ setAccessToken: vi.fn() }))

it('does not advertise another clinic’s demo credentials in a customer workspace', () => {
  render(<LoginPage />)
  expect(screen.getByLabelText('Email or mobile number')).toHaveAttribute(
    'placeholder',
    'Email or 0911234567'
  )
  expect(screen.queryByText('Demo workspace credentials')).not.toBeInTheDocument()
  expect(screen.queryByText(/admin@lemlemdental/)).not.toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: /create.*workspace|sign up|register/i })
  ).not.toBeInTheDocument()
})
