'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { AuthenticatedUser, getCurrentUser } from '@/lib/api-client'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [identity, setIdentity] = useState<AuthenticatedUser | null>()

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) router.replace('/login')
      setIdentity(user)
    })
  }, [router])

  if (!identity) return null

  return (
    <DashboardShell
      user={{
        name: identity.name,
        email: identity.email,
        role: identity.roles[0] || 'STAFF',
      }}
    >
      {children}
    </DashboardShell>
  )
}
