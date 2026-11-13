import { prisma } from '@/lib/prisma'

/** Who created, changed or removed a braces record. Best effort: never blocks the clinical save. */
export async function bracesAudit(
  hospitalId: string,
  userId: string | undefined | null,
  action: string,
  entityType: string,
  entityId: string,
  values?: unknown
) {
  try {
    await prisma.auditLog.create({
      data: {
        hospitalId,
        userId: userId ?? null,
        action,
        entityType,
        entityId,
        newValues: values === undefined ? null : JSON.stringify(values).slice(0, 60_000),
      },
    })
  } catch (cause) {
    console.error('Braces audit log error:', cause)
  }
}
