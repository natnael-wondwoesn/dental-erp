'use client'

import { use } from 'react'

import { ImagingWorkspace } from '@/components/imaging/imaging-workspace'
import { useTenantAccess } from '@/components/saas/tenant-access'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ImagingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const access = useTenantAccess()

  if (access && !(access.modules as string[]).includes('imaging')) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Imaging module is not enabled</CardTitle>
          <CardDescription>Ask your administrator to enable it for this clinic.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <ImagingWorkspace patientId={id} />
}
