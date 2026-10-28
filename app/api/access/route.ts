import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedHospital } from '@/lib/api-helpers'
import { getAuthenticatedPatient } from '@/lib/patient-auth'
import { loadSaaSAccess } from '@/lib/saas/server'

export async function GET(request: NextRequest) {
  const current = await getAuthenticatedHospital()
  const tenantId = current.hospitalId || (await getAuthenticatedPatient(request))?.hospitalId
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await loadSaaSAccess(tenantId), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ error: 'Subscription verification unavailable' }, { status: 503 })
  }
}
