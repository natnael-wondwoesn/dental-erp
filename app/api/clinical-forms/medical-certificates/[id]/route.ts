import { NextResponse } from 'next/server'

import { requireAuthAndRole } from '@/lib/api-helpers'
import { MEDICAL_CERTIFICATE_TEMPLATE_NAME } from '@/lib/clinical-forms/medical-certificate'
import { prisma } from '@/lib/prisma'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR', 'RECEPTIONIST'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const submission = await prisma.formSubmission.findFirst({
    where: { id, hospitalId, template: { name: MEDICAL_CERTIFICATE_TEMPLATE_NAME } },
    include: { template: { select: { name: true } } },
  })
  if (!submission)
    return NextResponse.json({ error: 'Medical certificate not found' }, { status: 404 })

  const clinic = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: {
      name: true,
      logo: true,
      address: true,
      city: true,
      phone: true,
      email: true,
      registrationNo: true,
    },
  })

  return NextResponse.json({ certificate: submission, clinic })
}
