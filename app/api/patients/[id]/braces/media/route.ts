import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuthAndRole } from '@/lib/api-helpers'
import { bracesAudit } from '@/lib/braces/audit'
import {
  bracesMediaSchema,
  mediaData,
  PHOTO_CATEGORIES,
  XRAY_CATEGORIES,
} from '@/lib/braces/schema'
import { prisma } from '@/lib/prisma'

// POST - categorise an uploaded photo / X-ray. The file was uploaded through the documents API;
// the original is kept as it is, this only adds category, stage, date and notes.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId, user } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const input = bracesMediaSchema.parse(await request.json())
    const allowed: readonly string[] = input.kind === 'PHOTO' ? PHOTO_CATEGORIES : XRAY_CATEGORIES
    if (!allowed.includes(input.category))
      return NextResponse.json({ error: 'Unknown category' }, { status: 400 })
    const document = await prisma.document.findFirst({
      where: { id: input.documentId, hospitalId, patientId: id },
    })
    if (!document) return NextResponse.json({ error: 'File not found' }, { status: 404 })
    const bracesCase = await prisma.bracesCase.upsert({
      where: { hospitalId_patientId: { hospitalId, patientId: id } },
      create: { hospitalId, patientId: id },
      update: {},
    })
    const media = await prisma.bracesMedia.create({
      data: {
        ...mediaData(input),
        hospitalId,
        bracesCaseId: bracesCase.id,
        uploadedById: user?.id ?? null,
      },
    })
    await bracesAudit(hospitalId, user?.id, 'BRACES_MEDIA_CREATE', 'BracesMedia', media.id, {
      kind: media.kind,
      category: media.category,
    })
    return NextResponse.json({ media }, { status: 201 })
  } catch (cause) {
    if (cause instanceof z.ZodError)
      return NextResponse.json(
        { error: cause.issues[0]?.message || 'Invalid record' },
        { status: 400 }
      )
    console.error('Create braces media error:', cause)
    return NextResponse.json({ error: 'Failed to save record' }, { status: 500 })
  }
}
