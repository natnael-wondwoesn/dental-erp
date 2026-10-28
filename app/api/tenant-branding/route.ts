import { NextRequest, NextResponse } from 'next/server'
import { resolvePublicBrand } from '@/lib/saas/public-brand'

export async function GET(request: NextRequest) {
  const hostname = request.headers.get('host')?.split(':')[0]?.toLowerCase() || ''
  const profile = await resolvePublicBrand(hostname)
  return NextResponse.json(profile || { name: 'Dental Clinic', branding: {} }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
