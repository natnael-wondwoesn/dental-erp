import { NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { loadPrescriptionPaper } from '@/lib/clinical-forms/load-prescription-paper'
import { renderPrescriptionPaperHtml } from '@/lib/clinical-forms/prescription-paper'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR', 'RECEPTIONIST'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const paper = await loadPrescriptionPaper(id, hospitalId)
  if (!paper) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })
  return new Response(renderPrescriptionPaperHtml(paper.data, paper.clinic), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${paper.data.prescriptionNo}.html"`,
    },
  })
}
