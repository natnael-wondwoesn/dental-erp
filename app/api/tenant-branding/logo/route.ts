import { NextRequest, NextResponse } from 'next/server'
import { resolvePublicBrand } from '@/lib/saas/public-brand'
import { getStorage, keyBelongsToHospital, toStorageKey } from '@/lib/storage'

export async function GET(request: NextRequest) {
  try {
    const hostname = request.headers.get('host')?.split(':')[0]?.toLowerCase() || ''
    const profile = await resolvePublicBrand(hostname)
    if (!profile) return new NextResponse(null, { status: 404 })
    const requested = profile.branding?.logo?.replace(/^\/api\/uploads\//, '')
    if (!requested || !keyBelongsToHospital(requested, profile.tenantId))
      return new NextResponse(null, { status: 404 })
    const asset = await getStorage().get(toStorageKey(requested))
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(asset.contentType))
      return new NextResponse(null, { status: 415 })
    return new NextResponse(new Uint8Array(asset.body), {
      headers: {
        'Content-Type': asset.contentType,
        'Cache-Control': 'public, max-age=60',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
