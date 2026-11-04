import { NextResponse } from 'next/server'

import { requireAuthAndRole } from '@/lib/api-helpers'
import {
  CLINIC_PRINTABLES,
  isClinicPrintableKey,
  isClinicPrintableAllowedForClinic,
  renderClinicPrintableHtml,
} from '@/lib/clinical-forms/clinic-printables'
import { nextAttachmentNumber } from '@/lib/clinical-forms/attachment-number'
import { prisma } from '@/lib/prisma'
import { brandClinic } from '@/lib/saas/branding'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ template: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR', 'RECEPTIONIST'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { template } = await params
  if (!isClinicPrintableKey(template))
    return NextResponse.json({ error: 'Printable form not found' }, { status: 404 })

  const clinic = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: {
      name: true,
      logo: true,
      address: true,
      city: true,
      phone: true,
      alternatePhone: true,
      email: true,
      registrationNo: true,
    },
  })
  if (!isClinicPrintableAllowedForClinic(template, clinic?.name || '')) {
    return NextResponse.json({ error: 'Printable form not found' }, { status: 404 })
  }
  const html = renderClinicPrintableHtml(
    template,
    await brandClinic(hospitalId, clinic || { name: 'Dental Clinic' }),
    // Each opened attachment consumes the next sequential number (001, 002, ...)
    template === 'cash-sales-attachment' ? await nextAttachmentNumber(hospitalId) : undefined
  )
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${CLINIC_PRINTABLES[template].toLowerCase().replaceAll(' ', '-')}.html"`,
    },
  })
}
