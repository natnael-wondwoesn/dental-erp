import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuthAndRole } from '@/lib/api-helpers'
import {
  MEDICAL_CERTIFICATE_TEMPLATE_NAME,
  renderMedicalCertificateHtml,
  type MedicalCertificateData,
} from '@/lib/clinical-forms/medical-certificate'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/services/email.service'

const emailSchema = z.object({ email: z.email() })

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const { email } = emailSchema.parse(await request.json())
    const submission = await prisma.formSubmission.findFirst({
      where: { id, hospitalId, template: { name: MEDICAL_CERTIFICATE_TEMPLATE_NAME } },
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
    const data = submission.data as unknown as MedicalCertificateData
    const html = renderMedicalCertificateHtml(
      data,
      clinic || { name: 'Sunny Smile Speciality Clinic' }
    )

    await emailService.sendEmail({
      hospitalId,
      patientId: submission.patientId || undefined,
      to: email,
      subject: `${data.certificateNo} — Medical Certificate`,
      body: `<p>Dear ${data.patientFullName},</p><p>Your medical certificate from ${clinic?.name || 'Sunny Smile Speciality Clinic'} is attached. Open the attachment to review or print it.</p><p>Certificate: <strong>${data.certificateNo}</strong></p>`,
      attachments: [
        {
          filename: `${data.certificateNo}.html`,
          content: html,
          contentType: 'text/html; charset=utf-8',
        },
      ],
    })

    return NextResponse.json({ success: true, message: 'Medical certificate emailed successfully' })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Failed to email medical certificate'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
