import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuthAndRole } from '@/lib/api-helpers'
import { bracesAudit } from '@/lib/braces/audit'
import { hasChartContent, palmerChartUpdateSchema } from '@/lib/braces/schema'
import { prisma } from '@/lib/prisma'

// PUT - reopen a saved assessment and save its Palmer chart again. Only the chart can change;
// every other field of a dated assessment stays exactly as it was recorded.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assessmentId: string }> }
) {
  const { error, hospitalId, user } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id, assessmentId } = await params
    const { palmerChart } = palmerChartUpdateSchema.parse(await request.json())
    const existing = await prisma.bracesAssessment.findFirst({
      where: { id: assessmentId, hospitalId, bracesCase: { patientId: id } },
    })
    if (!existing) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    const assessment = await prisma.bracesAssessment.update({
      where: { id: assessmentId },
      data: { palmerChart: hasChartContent(palmerChart) ? palmerChart : Prisma.DbNull },
    })
    await bracesAudit(
      hospitalId,
      user?.id,
      'BRACES_ASSESSMENT_CHART_UPDATE',
      'BracesAssessment',
      assessmentId
    )
    return NextResponse.json({ assessment })
  } catch (cause) {
    if (cause instanceof z.ZodError)
      return NextResponse.json(
        { error: cause.issues[0]?.message || 'Invalid chart' },
        { status: 400 }
      )
    console.error('Update braces assessment chart error:', cause)
    return NextResponse.json({ error: 'Failed to save chart' }, { status: 500 })
  }
}
