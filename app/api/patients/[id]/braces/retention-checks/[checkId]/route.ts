import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuthAndRole } from '@/lib/api-helpers'
import { bracesAudit } from '@/lib/braces/audit'
import { prisma } from '@/lib/prisma'

// DELETE - remove a retention check added by mistake (audited).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; checkId: string }> }
) {
  const { error, hospitalId, user } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId)
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, checkId } = await params
  const check = await prisma.bracesRetentionCheck.findFirst({
    where: { id: checkId, hospitalId, bracesCase: { patientId: id } },
  })
  if (!check) return NextResponse.json({ error: 'Check not found' }, { status: 404 })
  await prisma.bracesRetentionCheck.delete({ where: { id: checkId } })
  await bracesAudit(
    hospitalId,
    user?.id,
    'BRACES_RETENTION_CHECK_DELETE',
    'BracesRetentionCheck',
    checkId
  )
  return NextResponse.json({ success: true })
}
