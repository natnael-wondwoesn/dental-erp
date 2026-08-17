'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Banknote,
  CircleDollarSign,
  ReceiptText,
  TrendingUp,
  WalletCards,
} from 'lucide-react'

type FinanceOverview = {
  thisMonthRevenue: number
  pendingPayments: number
  monthExpenses: number
  netCashFlow: number
}

const money = (value: number) =>
  new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    maximumFractionDigits: 0,
  }).format(value)

export default function FinancePage() {
  const [overview, setOverview] = useState<FinanceOverview | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setOverview(data.overview))
      .catch(() => setOverview(null))
  }, [])

  const cards = [
    [
      'Revenue / income',
      overview ? money(overview.thisMonthRevenue) : '—',
      CircleDollarSign,
      'Collected this month',
    ],
    ['Expenses', overview ? money(overview.monthExpenses) : '—', ReceiptText, 'Posted this month'],
    [
      'Net cash flow',
      overview ? money(overview.netCashFlow) : '—',
      TrendingUp,
      'Income less expenses',
    ],
    [
      'Receivables',
      overview ? money(overview.pendingPayments) : '—',
      WalletCards,
      'Outstanding patient balances',
    ],
  ] as const

  return (
    <div className="mx-auto max-w-[1540px] space-y-5 pb-8 text-[#13233a]">
      <section className="rounded-[28px] bg-[#10233f] px-7 py-8 text-white sm:px-10">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-blue-200">
          Accounting & finance
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-.04em]">
          A clear ETB view of clinic cash
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          Revenue, expenses, dentist commissions, cash flow and financial reporting share the same
          posted transactions and audit trail.
        </p>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon, detail]) => (
          <article
            key={label}
            className="rounded-[22px] border border-[#e6edf7] bg-white p-5 shadow-[0_12px_34px_rgba(31,60,102,.055)]"
          >
            <Icon className="h-5 w-5 text-[#0769e7]" />
            <p className="mt-5 text-xs font-semibold uppercase tracking-[.12em] text-slate-400">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-.035em]">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
          </article>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        {[
          [
            'Billing & receipts',
            'Issue invoices, allocate cash, bank and mobile-money payments, then print traceable receipts.',
            '/billing',
          ],
          [
            'Dentist commissions',
            'Configure commission rules and produce reviewable statements from performed procedures.',
            '/staff',
          ],
          [
            'Financial reports',
            'Review collections, receivables, expense categories and clinic performance.',
            '/billing/reports',
          ],
        ].map(([title, copy, href]) => (
          <Link
            key={title}
            href={href}
            className="group rounded-[22px] border border-[#e6edf7] bg-white p-6 transition hover:border-blue-200 hover:bg-[#f8fbff]"
          >
            <Banknote className="h-6 w-6 text-[#0769e7]" />
            <h2 className="mt-5 text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{copy}</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#0769e7]">
              Open workspace <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </section>
    </div>
  )
}
