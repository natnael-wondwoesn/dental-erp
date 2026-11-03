import Link from 'next/link'
import { AuditLog } from '@/components/saas/audit-log'
import { ownerFetch, type AuditEvent } from '@/lib/saas/admin'

export const dynamic = 'force-dynamic'

export default async function AuditPage() {
  const data = await ownerFetch<{ events: AuditEvent[] }>('audit?limit=500')
  return (
    <div className="space-y-6">
      <div>
        <Link href="/owner" className="text-sm underline">
          Product operations
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Audit log</h1>
        <p className="mt-2 text-slate-600">
          Every change made to a clinic's subscription, modules, branding, profile and payments,
          newest first, with who made it.
        </p>
      </div>
      {data ? (
        <AuditLog events={data.events} />
      ) : (
        <p className="rounded-xl border bg-white p-6">
          SaaS control is unavailable. Try again shortly.
        </p>
      )}
    </div>
  )
}
