import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { requireAuthAndRole } from '@/lib/api-helpers'
import { bracesAudit } from '@/lib/braces/audit'
import { bracesMediaUpdateSchema, PHOTO_CATEGORIES, XRAY_CATEGORIES } from '@/lib/braces/schema'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string; mediaId: string }> }

// PATCH - edit an image's information (title, category, stage, date, notes, related visit).
// The stored image is never modified; the change is logged with the old and new values.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { error, hospitalId, user } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id, mediaId } = await params
    const input = bracesMediaUpdateSchema.parse(await request.json())
    const media = await prisma.bracesMedia.findFirst({
      where: { id: mediaId, hospitalId, bracesCase: { patientId: id } },
    })
    if (!media) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

    if (input.category) {
      const allowed: readonly string[] = media.kind === 'PHOTO' ? PHOTO_CATEGORIES : XRAY_CATEGORIES
      if (!allowed.includes(input.category))
        return NextResponse.json({ error: 'Unknown category' }, { status: 400 })
    }
    if (input.relatedVisitId) {
      const visit = await prisma.bracesVisit.findFirst({
        where: { id: input.relatedVisitId, hospitalId, bracesCase: { patientId: id } },
      })
      if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 400 })
    }

    const blank = (v: string | null | undefined) => (v === '' || v == null ? null : v)
    const data: Record<string, unknown> = {}
    if (input.category !== undefined) data.category = input.category
    if (input.title !== undefined) data.title = blank(input.title)
    if (input.relatedVisitId !== undefined) data.relatedVisitId = blank(input.relatedVisitId)
    if (input.stage !== undefined) data.stage = blank(input.stage)
    if (input.capturedAt !== undefined) data.capturedAt = new Date(input.capturedAt)
    if (input.interpretation !== undefined) data.interpretation = blank(input.interpretation)
    if (input.notes !== undefined) data.notes = blank(input.notes)

    if (input.annotations !== undefined)
      data.annotations = input.annotations === null ? Prisma.DbNull : input.annotations

    const updated = await prisma.bracesMedia.update({ where: { id: mediaId }, data })
    // Saving drawings is logged on its own so the history can say "Annotation saved".
    const infoChanged = Object.keys(data).filter((k) => k !== 'annotations')
    if (infoChanged.length)
      await bracesAudit(hospitalId, user?.id, 'BRACES_MEDIA_UPDATE', 'BracesMedia', mediaId, {
        changed: infoChanged,
      })
    if (input.annotations !== undefined)
      await bracesAudit(hospitalId, user?.id, 'BRACES_ANNOTATION_SAVE', 'BracesMedia', mediaId, {
        count: input.annotations?.items.length ?? 0,
      })
    return NextResponse.json({ media: updated })
  } catch (cause) {
    if (cause instanceof z.ZodError)
      return NextResponse.json(
        { error: cause.issues[0]?.message || 'Invalid data' },
        { status: 400 }
      )
    console.error('Update braces media error:', cause)
    return NextResponse.json({ error: 'Failed to update image information' }, { status: 500 })
  }
}

// DELETE - remove a record added by mistake. The uploaded file is archived, never destroyed.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const { error, hospitalId, user } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, mediaId } = await params
  const media = await prisma.bracesMedia.findFirst({
    where: { id: mediaId, hospitalId, bracesCase: { patientId: id } },
  })
  if (!media) return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  await prisma.document.updateMany({
    where: { id: media.documentId, hospitalId },
    data: { isArchived: true },
  })
  await prisma.bracesMedia.delete({ where: { id: mediaId } })
  await bracesAudit(hospitalId, user?.id, 'BRACES_MEDIA_DELETE', 'BracesMedia', mediaId, {
    kind: media.kind,
    category: media.category,
    documentId: media.documentId,
  })
  return NextResponse.json({ success: true })
}
