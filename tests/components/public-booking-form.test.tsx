import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PublicBookingForm } from '@/components/site/public-booking-form'
import { LanguageProvider } from '@/lib/i18n'

function response(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response)
}

describe('PublicBookingForm', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('loads public doctors without requiring staff or patient authentication', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      response({
        hospitalName: 'Sunny Smile Speciality Clinic',
        doctors: [{ id: 'd1', firstName: 'Selam', lastName: 'Abebe', specialization: 'General' }],
      })
    )

    render(
      <LanguageProvider>
        <PublicBookingForm clinicSlug="demo-dental-clinic" />
      </LanguageProvider>
    )

    expect(await screen.findByRole('option', { name: /selam abebe/i })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/public/demo-dental-clinic/doctors')
  })

  it('loads free slots and sends a complete public booking', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() =>
        response({
          doctors: [{ id: 'd1', firstName: 'Selam', lastName: 'Abebe', specialization: null }],
        })
      )
      .mockImplementationOnce(() => response({ slots: [{ time: '10:00', available: true }] }))
      .mockImplementationOnce(() =>
        response({
          appointment: {
            appointmentNo: 'APT-WEB-123',
            date: '2099-03-15',
            time: '10:00',
            doctor: 'Dr. Selam Abebe',
          },
        })
      )

    render(
      <LanguageProvider>
        <PublicBookingForm clinicSlug="demo-dental-clinic" />
      </LanguageProvider>
    )
    fireEvent.change(await screen.findByLabelText(/choose a doctor/i), { target: { value: 'd1' } })
    fireEvent.change(screen.getByLabelText(/appointment date/i), {
      target: { value: '2099-03-15' },
    })
    fireEvent.click(await screen.findByRole('button', { name: '10:00' }))
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Abel' } })
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Tesfaye' } })
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '0911234567' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm appointment/i }))

    expect(await screen.findByText('APT-WEB-123')).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const bookingCall = fetchMock.mock.calls[2]
    expect(bookingCall[0]).toBe('/api/public/demo-dental-clinic/book')
    expect(JSON.parse(String((bookingCall[1] as RequestInit).body))).toMatchObject({
      firstName: 'Abel',
      lastName: 'Tesfaye',
      phone: '0911234567',
      doctorId: 'd1',
      time: '10:00',
    })
  })
})
