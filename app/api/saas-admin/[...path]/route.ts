import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/platform-control'
import { saasFetch } from '@/lib/saas/server'

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const owner = await requirePlatformOwner()
  if (!owner) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const origin = request.headers.get('origin')
  const expectedOrigin = process.env.NEXTAUTH_URL
    ? new URL(process.env.NEXTAUTH_URL).origin
    : request.nextUrl.origin
  if (origin && origin !== expectedOrigin) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  }
  const { path } = await context.params
  if (
    !/^tenants(?:\/[A-Za-z0-9_-]+(?:\/(modules|branding|suspension|renew|history|license|client-options))?)?$/.test(
      path.join('/')
    )
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  try {
    const response = await saasFetch(`admin/${path.map(encodeURIComponent).join('/')}`, true, {
      method: request.method,
      headers: { 'X-Actor': owner.user.id },
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text(),
    })
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ error: 'SaaS control unavailable' }, { status: 503 })
  }
}

export const GET = forward
export const POST = forward
export const PUT = forward
