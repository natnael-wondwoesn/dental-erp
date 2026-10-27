import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'

// GET - A patient's open invoices and their total outstanding balance
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const patientId = new URL(request.url).searchParams.get('patientId')
  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        hospitalId,
        patientId,
        status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
        balanceAmount: { gt: 0 },
      },
      select: {
        id: true,
        invoiceNo: true,
        status: true,
        totalAmount: true,
        paidAmount: true,
        balanceAmount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const totalOutstanding = invoices.reduce((sum, i) => sum + Number(i.balanceAmount), 0)
    return NextResponse.json({ invoices, totalOutstanding })
  } catch (err) {
    console.error('Error fetching patient outstanding:', err)
    return NextResponse.json({ error: 'Failed to fetch outstanding balance' }, { status: 500 })
  }
}
