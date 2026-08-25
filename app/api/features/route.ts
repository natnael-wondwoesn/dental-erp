import { NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { getPublicFeatureEntitlements } from '@/lib/features'

export async function GET() {
  const { error } = await requireAuthAndRole()
  if (error) return error

  return NextResponse.json({ features: getPublicFeatureEntitlements() })
}
