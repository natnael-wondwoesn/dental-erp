import Link from 'next/link'
import { FleetConsole } from '@/components/saas/fleet-console'
import { ownerFetch, type Overview } from '@/lib/saas/admin'
import type { SaaSAccess } from '@/lib/saas/catalog'

export const dynamic = 'force-dynamic'

export default async function FleetPage() {
  const [overview, tenants] = await Promise.all([
    ownerFetch<Overview>('overview'),
    ownerFetch<{ tenants: SaaSAccess[] }>('tenants'),
  ])
  if (!overview || !tenants)
    return (
      <section className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Fleet overview</h1>
        <p className="mt-3">SaaS control is unavailable. Try again shortly.</p>
      </section>
    )
  return (
    <div className="space-y-6">
      <div>
        <Link href="/owner" className="text-sm underline">
          Product operations
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Fleet overview</h1>
        <p className="mt-2 text-slate-600">
          Every clinic at a glance: status, upcoming expiries, revenue and which modules each one
          has. Select clinics in the matrix to add or remove a module for all of them at once.
        </p>
      </div>
      <FleetConsole overview={overview} initial={tenants.tenants} />
    </div>
  )
}
