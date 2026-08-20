import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { loadPrescriptionPaper } from '@/lib/clinical-forms/load-prescription-paper'
import { renderPrescriptionPaperHtml } from '@/lib/clinical-forms/prescription-paper'
import { emailService } from '@/lib/services/email.service'

const schema = z.object({ email: z.email() })

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { email } = schema.parse(await request.json())
    const { id } = await params
    const paper = await loadPrescriptionPaper(id, hospitalId)
    if (!paper) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })
    const html = renderPrescriptionPaperHtml(paper.data, paper.clinic)
    await emailService.sendEmail({
      hospitalId,
      patientId: paper.prescription.patientId,
      to: email,
      subject: `${paper.data.prescriptionNo} — Prescription`,
      body: `<p>Dear ${paper.data.patient.fullName},</p><p>Your prescription from ${paper.clinic.name} is attached. Open it to review or print.</p>`,
      attachments: [
        {
          filename: `${paper.data.prescriptionNo}.html`,
          content: html,
          contentType: 'text/html; charset=utf-8',
        },
      ],
    })
    return NextResponse.json({ success: true })
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : 'Failed to email prescription' },
      { status: 500 }
    )
  }
}
