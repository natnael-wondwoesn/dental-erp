import { prisma } from '@/lib/prisma'

const KEY = 'cash_sales_attachment_last_no'
const MAX_ATTEMPTS = 8

export function formatAttachmentNumber(n: number): string {
  return String(n).padStart(3, '0')
}

/**
 * Returns the next per-clinic attachment number (001, 002, ...), persisted in the
 * Setting table. Uses compare-and-swap so concurrent requests never share a number.
 */
export async function nextAttachmentNumber(hospitalId: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const current = await prisma.setting.findUnique({
      where: { hospitalId_key: { hospitalId, key: KEY } },
      select: { value: true },
    })

    if (!current) {
      try {
        await prisma.setting.create({
          data: {
            hospitalId,
            key: KEY,
            value: '1',
            type: 'number',
            category: 'forms',
            description: 'Last issued cash sales attachment number',
          },
        })
        return formatAttachmentNumber(1)
      } catch {
        continue // another request created it first; retry as an update
      }
    }

    const next = (parseInt(current.value, 10) || 0) + 1
    const { count } = await prisma.setting.updateMany({
      where: { hospitalId, key: KEY, value: current.value },
      data: { value: String(next) },
    })
    if (count === 1) return formatAttachmentNumber(next)
  }
  throw new Error('Could not allocate attachment number')
}
