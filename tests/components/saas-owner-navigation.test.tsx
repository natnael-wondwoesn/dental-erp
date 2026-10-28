import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({ replace: vi.fn(), path: '/owner/clinics' }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.path,
  useRouter: () => navigation,
}))
vi.mock('@/lib/api-client', () => ({
  getCurrentUser: async () => ({
    id: 'vendor',
    name: 'Vendor',
    email: 'vendor@example.invalid',
    roles: ['ADMIN'],
    isPlatformOwner: true,
    isPlatformControlPlane: true,
    clinicName: 'Vendor',
  }),
}))
vi.mock('@/components/layout/dashboard-shell', () => ({
  DashboardShell: ({ children }: any) => children,
}))
vi.mock('@/components/saas/tenant-access', () => ({
  TenantAccessProvider: ({ children }: any) => children,
  TenantWorkspace: ({ children }: any) => children,
  ModularDashboard: () => null,
}))
import DashboardLayout from '@/app/(dashboard)/layout'

beforeEach(() => vi.clearAllMocks())

it('keeps vendor clinic management open after identity loads', async () => {
  render(
    <DashboardLayout>
      <p>Clinic controls</p>
    </DashboardLayout>
  )
  await waitFor(() => expect(screen.getByText('Clinic controls')).toBeInTheDocument())
  expect(navigation.replace).not.toHaveBeenCalled()
})
