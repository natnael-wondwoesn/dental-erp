import { NextRequest, NextResponse } from 'next/server'

import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

const LABELS: Record<string, string> = {
  BRACES_MEDIA_CREATE: 'Image uploaded',
  BRACES_MEDIA_UPDATE: 'Image information updated',
  BRACES_MEDIA_DELETE: 'Image removed',
  BRACES_ANNOTATION_SAVE: 'Annotation saved',
}

// GET - who did what to this image, newest first (from the audit trail).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR', 'RECEPTIONIST'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, mediaId } = await params
  const media = await prisma.bracesMedia.findFirst({
    where: { id: mediaId, hospitalId, bracesCase: { patientId: id } },
    select: { id: true },
  })
  if (!media) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  const rows = await prisma.auditLog.findMany({
    where: { hospitalId, entityType: 'BracesMedia', entityId: mediaId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      action: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  })
  return NextResponse.json({
    history: rows.map((r) => ({
      id: r.id,
      label: LABELS[r.action] ?? r.action,
      at: r.createdAt,
      by: r.user?.name ?? null,
    })),
  })
}
