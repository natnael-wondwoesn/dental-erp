import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'

// GET - One summarized row per patient with an unpaid balance
export async function GET() {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        hospitalId,
        status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
        balanceAmount: { gt: 0 },
      },
      select: {
        patientId: true,
        totalAmount: true,
        paidAmount: true,
        balanceAmount: true,
        status: true,
        createdAt: true,
        patient: {
          select: { id: true, patientId: true, firstName: true, lastName: true, phone: true },
        },
      },
    })

    const byPatient = new Map<
      string,
      {
        patient: { id: string; patientId: string; name: string; phone: string }
        invoiceCount: number
        overdueCount: number
        totalBilled: number
        totalPaid: number
        totalOutstanding: number
        oldestInvoiceAt: Date
      }
    >()
    for (const inv of invoices) {
      const row = byPatient.get(inv.patientId) ?? {
        patient: {
          id: inv.patient.id,
          patientId: inv.patient.patientId,
          name: `${inv.patient.firstName} ${inv.patient.lastName}`.trim(),
          phone: inv.patient.phone,
        },
        invoiceCount: 0,
        overdueCount: 0,
        totalBilled: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        oldestInvoiceAt: inv.createdAt,
      }
      row.invoiceCount += 1
      if (inv.status === 'OVERDUE') row.overdueCount += 1
      row.totalBilled += Number(inv.totalAmount)
      row.totalPaid += Number(inv.paidAmount)
      row.totalOutstanding += Number(inv.balanceAmount)
      if (inv.createdAt < row.oldestInvoiceAt) row.oldestInvoiceAt = inv.createdAt
      byPatient.set(inv.patientId, row)
    }

    const patients = [...byPatient.values()].sort((a, b) => b.totalOutstanding - a.totalOutstanding)
    return NextResponse.json({
      patients,
      totals: {
        patientCount: patients.length,
        invoiceCount: invoices.length,
        totalOutstanding: patients.reduce((s, p) => s + p.totalOutstanding, 0),
      },
    })
  } catch (err) {
    console.error('Error fetching outstanding balances:', err)
    return NextResponse.json({ error: 'Failed to fetch outstanding balances' }, { status: 500 })
  }
}
