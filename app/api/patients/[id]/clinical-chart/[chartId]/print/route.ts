import { NextResponse } from 'next/server'

import { requireAuthAndRole } from '@/lib/api-helpers'
import {
  PATIENT_CHART_TEMPLATE_NAME,
  renderPatientChartHtml,
  type PatientChartData,
} from '@/lib/clinical-forms/patient-chart'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; chartId: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR', 'RECEPTIONIST'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, chartId } = await params
  const [submission, clinic] = await Promise.all([
    prisma.formSubmission.findFirst({
      where: {
        id: chartId,
        patientId: id,
        hospitalId,
        template: { name: PATIENT_CHART_TEMPLATE_NAME },
      },
    }),
    prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: {
        name: true,
        logo: true,
        address: true,
        city: true,
        phone: true,
        alternatePhone: true,
      },
    }),
  ])
  if (!submission) return NextResponse.json({ error: 'Clinical chart not found' }, { status: 404 })
  const data = submission.data as unknown as PatientChartData
  return new Response(
    renderPatientChartHtml(
      data,
      clinic || { name: 'D/R Lemlem Special Dental Clinic' },
      submission.signature
    ),
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${data.chartNo}.html"`,
      },
    }
  )
}
