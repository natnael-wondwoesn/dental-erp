import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import PortalLayout from '@/app/portal/(secure)/layout'
const mocks = vi.hoisted(() => ({
  patient: vi.fn(),
  brand: vi.fn(),
  clinic: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error('redirect:' + path)
  }),
}))
vi.mock('@/lib/patient-auth', () => ({ getAuthenticatedPatient: mocks.patient }))
vi.mock('@/lib/saas/public-brand', () => ({ publicBrand: mocks.brand }))
vi.mock('@/lib/prisma', () => ({ prisma: { hospital: { findUnique: mocks.clinic } } }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/components/portal/portal-shell', () => ({
  PortalShell: ({ children, patient, hospital }: any) => (
    <section aria-label={hospital.name}>
      {patient.name}
      {children}
    </section>
  ),
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.patient.mockResolvedValue(null)
  mocks.brand.mockResolvedValue({ tenantId: 'clinic-1', slug: 'test-clinic' })
  mocks.clinic.mockResolvedValue({
    name: 'Test Clinic',
    slug: 'test-clinic',
    logo: null,
    isActive: true,
  })
})
it('redirects visitors and staff without patient sessions before loading secure content', async () => {
  await expect(PortalLayout({ children: <p>Private records</p> })).rejects.toThrow(
    'redirect:/portal/login?clinic=test-clinic'
  )
  expect(mocks.clinic).not.toHaveBeenCalled()
})
it('rejects patient cookies from a different clinic', async () => {
  mocks.patient.mockResolvedValue({ hospitalId: 'other-clinic' })
  await expect(PortalLayout({ children: null })).rejects.toThrow('redirect:')
  expect(mocks.clinic).not.toHaveBeenCalled()
})
it('renders the patient shell only for the active bound clinic', async () => {
  mocks.patient.mockResolvedValue({
    hospitalId: 'clinic-1',
    firstName: 'Test',
    lastName: 'Patient',
    patientId: 'QA-1',
    phone: '0000000000',
  })
  render(await PortalLayout({ children: <p>Patient dashboard</p> }))
  expect(screen.getByRole('region', { name: 'Test Clinic' })).toHaveTextContent('Test Patient')
  expect(screen.getByText('Patient dashboard')).toBeInTheDocument()
  expect(mocks.clinic).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'clinic-1' } }))
})
it('rejects an inactive clinic', async () => {
  mocks.patient.mockResolvedValue({ hospitalId: 'clinic-1' })
  mocks.clinic.mockResolvedValue({ isActive: false })
  await expect(PortalLayout({ children: null })).rejects.toThrow('redirect:')
})
