import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { getLicenseRuntime } from '@/lib/licensing/license-runtime'

export async function POST(request: NextRequest) {
  const { error } = await requireAuthAndRole(['ADMIN'], { enforceLicense: false })
  if (error) return error
  try {
    const licenseDocument: unknown = await request.json()
    return NextResponse.json(
      await getLicenseRuntime().importLicense(JSON.stringify(licenseDocument))
    )
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Invalid license document'
    return NextResponse.json({ code: 'LICENSE_IMPORT_FAILED', message }, { status: 422 })
  }
}
