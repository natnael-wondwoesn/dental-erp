import { notFound } from 'next/navigation'
import { requirePlatformOwner } from '@/lib/platform-control'
import { saasFetch } from '@/lib/saas/server'
import { ClinicManager } from '@/components/saas/clinic-manager'
import type { SaaSAccess } from '@/lib/saas/catalog'

export const dynamic = 'force-dynamic'

export default async function ClinicsPage() {
  const owner = await requirePlatformOwner()
  if (!owner) notFound()
  let tenants: SaaSAccess[] | null = null
  try {
    const response = await saasFetch('admin/tenants', true, {
      headers: { 'X-Actor': owner.user.id },
    })
    if (!response.ok) throw new Error('Control unavailable')
    tenants = (await response.json()).tenants
  } catch {
    tenants = null
  }
  if (tenants === null)
    return (
      <section className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Clinic subscriptions</h1>
        <p className="mt-3">
          SaaS control is unavailable. Check private backend connection before changing
          subscriptions.
        </p>
      </section>
    )
  return <ClinicManager initial={tenants} />
}
