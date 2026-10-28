import { NextResponse } from 'next/server'
import { loadSaaSAccess } from './server'
import { hasClientOption, type ClientOption } from './client-options'

/** Owner grants supplement existing authentication, roles and tenant checks. */
export async function requireClientOption(
  tenantId: string,
  user: { isPlatformOwner?: boolean } | null,
  option: ClientOption
) {
  if (user?.isPlatformOwner === true) return null
  try {
    const access = await loadSaaSAccess(tenantId)
    if (access.tenantId === tenantId && hasClientOption(access, option)) return null
    return NextResponse.json(
      {
        error: 'This option requires your software owner’s approval',
        code: 'CLIENT_OPTION_NOT_GRANTED',
      },
      { status: 403 }
    )
  } catch {
    return NextResponse.json(
      { error: 'Owner permission could not be verified', code: 'CLIENT_OPTION_UNAVAILABLE' },
      { status: 503 }
    )
  }
}
