'use client'

import { use } from 'react'

import { BracesWorkspace } from '@/components/braces/braces-workspace'
import { useTenantAccess } from '@/components/saas/tenant-access'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function BracesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const access = useTenantAccess()

  if (access && !access.modules.includes('braces' as never)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Braces module is not enabled</CardTitle>
          <CardDescription>Ask your administrator to enable it for this clinic.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <BracesWorkspace patientId={id} />
}
