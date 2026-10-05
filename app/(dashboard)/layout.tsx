'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { AuthenticatedUser, getCurrentUser } from '@/lib/api-client'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [identity, setIdentity] = useState<AuthenticatedUser | null>()

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) router.replace('/login')
      else if (user.isPlatformControlPlane && window.location.pathname !== '/owner') {
        router.replace('/owner')
      } else if (user.roles.includes('DOCTOR') && pathname === '/dashboard') {
        router.replace('/doctor/dashboard')
      }
      setIdentity(user)
    })
  }, [pathname, router])

  if (!identity) return null

  return (
    <DashboardShell
      user={{
        name: identity.name,
        email: identity.email,
        role: identity.roles[0] || 'STAFF',
        isPlatformOwner: identity.isPlatformOwner,
      }}
      hospital={{
        name: identity.clinicName,
        plan: 'SELF_HOSTED',
      }}
      isPlatformControlPlane={identity.isPlatformControlPlane}
    >
      {children}
    </DashboardShell>
  )
}
