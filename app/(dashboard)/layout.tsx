'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { AuthenticatedUser, getCurrentUser } from '@/lib/api-client'
import {
  TenantAccessProvider,
  TenantWorkspace,
  ModularDashboard,
} from '@/components/saas/tenant-access'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [identity, setIdentity] = useState<AuthenticatedUser | null>()

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) router.replace('/login')
      else if (
        user.isPlatformControlPlane &&
        pathname !== '/owner' &&
        !pathname.startsWith('/owner/')
      ) {
        router.replace('/owner')
      } else if (!user.saas && user.roles.includes('DOCTOR') && pathname === '/dashboard') {
        router.replace('/doctor/dashboard')
      }
      setIdentity(user)
    })
  }, [pathname, router])

  if (!identity) return null

  return (
    <TenantAccessProvider initial={identity.saas}>
      <DashboardShell
        user={{
          name: identity.name,
          email: identity.email,
          role: identity.roles[0] || 'STAFF',
          isPlatformOwner: identity.isPlatformOwner,
        }}
        hospital={{
          name: identity.clinicName,
          plan: identity.saas?.planName || 'SELF_HOSTED',
          logo: identity.saas?.branding.logo,
        }}
        isPlatformControlPlane={identity.isPlatformControlPlane}
      >
        <TenantWorkspace>
          {identity.saas && ['/dashboard', '/doctor/dashboard'].includes(pathname) ? (
            <ModularDashboard />
          ) : (
            children
          )}
        </TenantWorkspace>
      </DashboardShell>
    </TenantAccessProvider>
  )
}
