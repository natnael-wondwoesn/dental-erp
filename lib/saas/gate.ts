import { jwtVerify } from 'jose'
import { getToken } from 'next-auth/jwt'
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedPatient } from '@/lib/patient-auth'
import { accessDenial, type SaaSAccess } from './catalog'
import { loadSaaSAccess, saasEnforcement } from './server'

const RECOVERY = new Set([
  '/api/health',
  '/api/ready',
  '/api/license/import',
  '/api/license/status',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/auth/[...nextauth]',
  '/api/settings/backup',
  '/api/settings/audit-logs',
  '/api/audit-log',
  '/api/access',
  '/api/recovery',
  '/api/tenant-branding',
  '/api/tenant-branding/logo',
])

async function requestTenant(request: NextRequest): Promise<string | null> {
  const pathname = request.nextUrl.pathname
  const publicMatch = pathname.match(/^\/api\/public\/([^/]+)\/(book|doctors|slots)$/)
  if (publicMatch) {
    return (
      (await prisma.hospital.findUnique({ where: { slug: publicMatch[1] }, select: { id: true } }))
        ?.id || null
    )
  }
  if (pathname.startsWith('/api/patient-portal/auth/')) {
    if (pathname.endsWith('/logout')) return null
    const body = await request
      .clone()
      .json()
      .catch(() => null)
    if (typeof body?.hospitalSlug !== 'string') return null
    return (
      (
        await prisma.hospital.findUnique({
          where: { slug: body.hospitalSlug },
          select: { id: true },
        })
      )?.id || null
    )
  }
  if (pathname.startsWith('/api/patient-portal/')) {
    return (await getAuthenticatedPatient(request))?.hospitalId || null
  }
  if (/^\/api\/payments\/public-(order|verify)$/.test(pathname)) {
    const body = await request
      .clone()
      .json()
      .catch(() => null)
    if (typeof body?.token !== 'string') return null
    return (
      (
        await prisma.paymentLink.findUnique({
          where: { token: body.token },
          select: { hospitalId: true },
        })
      )?.hospitalId || null
    )
  }
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) return null
  const bearer = request.headers.get('Authorization')
  const token = bearer?.startsWith('Bearer ')
    ? bearer.slice(7)
    : request.cookies.get('dental_erp_access_token')?.value
  let userId: unknown
  let hospitalId: unknown
  try {
    const claims = token
      ? (await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] }))
          .payload
      : await getToken({ req: request, secret })
    userId = claims?.sub || claims?.id
    hospitalId = claims?.hospitalId
  } catch {
    return null
  }
  if (typeof userId !== 'string' || typeof hospitalId !== 'string') return null
  const user = await prisma.user.findFirst({
    where: { id: userId, hospitalId, isActive: true, hospital: { isActive: true } },
    select: { hospitalId: true },
  })
  return user?.hospitalId || null
}

export async function evaluateSaaSGate(request: NextRequest): Promise<{
  response?: NextResponse
  access?: SaaSAccess
}> {
  if (saasEnforcement() === 'disabled') return {}
  const path = request.nextUrl.pathname.replace(/\/$/, '')
  if (!path.startsWith('/api/')) return {}
  if (
    RECOVERY.has(path) ||
    path.startsWith('/api/auth/') ||
    path.startsWith('/api/platform/worker/') ||
    path.startsWith('/api/saas-admin/') ||
    path === '/api/patient-portal/auth/logout'
  )
    return {}
  // Retention and provider reconciliation keep existing authentication/signature
  // checks. Cron handlers themselves filter eligible tenants before mutations.
  if (
    path.startsWith('/api/cron/') ||
    path.startsWith('/api/webhooks/payment/') ||
    path.startsWith('/api/track/')
  )
    return {}
  if (
    ['/api/public/signup', '/api/public/verify-email', '/api/public/invite/accept'].includes(path)
  )
    return {}
  try {
    const tenantId = await requestTenant(request)
    if (!tenantId)
      return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    const access = await loadSaaSAccess(tenantId)
    const hostname =
      request.headers.get('host')?.split(':')[0]?.toLowerCase() || request.nextUrl.hostname
    if (access.hostname && access.hostname !== hostname) {
      return { response: NextResponse.json({ error: 'Clinic hostname mismatch' }, { status: 403 }) }
    }
    // OTP issuance is authentication recovery. AI GET endpoints can execute
    // paid tools/write insights, so they require operational access too.
    const decisionMethod = path.startsWith('/api/patient-portal/auth/')
      ? 'GET'
      : path.startsWith('/api/ai/') || path === '/api/integrations/google-calendar/callback'
        ? 'POST'
        : request.method
    let denial = accessDenial(access, path, decisionMethod)
    if (path.startsWith('/api/reports/')) {
      const sources = {
        patient: ['patients', 'appointments', 'crm'],
        clinical: ['patients', 'clinical'],
        financial: ['billing', 'finance'],
        operational: ['appointments', 'clinical', 'staff', 'inventory'],
      } as const
      const kind = request.nextUrl.searchParams.get('type') || 'patient'
      const required = sources[kind as keyof typeof sources]
      if (!required || required.some((key) => !access.modules.includes(key)))
        denial = { status: 403, code: 'MODULE_NOT_ENABLED' }
    }
    if (denial)
      return {
        response: NextResponse.json(
          { error: denial.code, code: denial.code, state: access.state },
          { status: denial.status, headers: { 'Cache-Control': 'no-store' } }
        ),
      }
    return { access }
  } catch {
    return {
      response: NextResponse.json(
        { error: 'Subscription verification unavailable', code: 'SUBSCRIPTION_UNAVAILABLE' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      ),
    }
  }
}
