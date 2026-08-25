import { NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { getLicenseRuntime } from '@/lib/licensing/license-runtime'

export async function GET() {
  const { error } = await requireAuthAndRole(undefined, { enforceLicense: false })
  if (error) return error
  return NextResponse.json(await getLicenseRuntime().decide())
}
