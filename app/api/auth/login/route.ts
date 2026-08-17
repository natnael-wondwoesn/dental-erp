import { NextRequest, NextResponse } from 'next/server'
import { authenticateCredentials, signAccessToken, toAuthenticatedUser } from '@/lib/auth-compat'

export async function POST(req: NextRequest) {
  try {
    const result = await authenticateCredentials(await req.json())
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const accessToken = await signAccessToken(result.user)
    return NextResponse.json({
      accessToken,
      user: toAuthenticatedUser(result.user),
    })
  } catch (error) {
    console.error('Auth login error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
