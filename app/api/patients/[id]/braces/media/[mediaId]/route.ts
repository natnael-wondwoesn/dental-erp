import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuthAndRole } from '@/lib/api-helpers'
import { bracesAudit } from '@/lib/braces/audit'
import { prisma } from '@/lib/prisma'

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
