'use client'

import { useEffect, useState } from 'react'
import { AuthenticatedUser, getCurrentUser } from '@/lib/api-client'

export default function ProfileSettingsPage() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  useEffect(() => {
    getCurrentUser().then(setUser)
  }, [])

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">
          {user ? `${user.name} (${user.email})` : 'Loading your FastAPI profile…'}
        </p>
      </div>
    </div>
  )
}
