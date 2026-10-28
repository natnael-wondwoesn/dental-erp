import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requirePlatformOwner } from '@/lib/platform-control'
import { prisma } from '@/lib/prisma'
import { InstallationControls } from '@/components/platform/installation-controls'
import { productUserRoles } from '@/lib/platform-owner-operations'

export default async function OwnerAccessPage() {
  if (!(await requirePlatformOwner())) notFound()
  const installations = await prisma.platformInstallation.findMany({
    include: { product: true },
    orderBy: { name: 'asc' },
  })
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Clinic accounts and databases</h1>
        <p className="mt-2 text-slate-600">
          Software-owner controls for each issued installation. Every operation records your owner
          account and result.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <Link href="/owner" className="underline">
            Products, releases and backups
          </Link>
          <Link href="/owner/clinics" className="underline">
            Modules, billing and suspension
          </Link>
        </div>
      </div>
      {installations
        .filter((item) => productUserRoles[item.product.key])
        .map((item) => (
          <InstallationControls
            key={item.id}
            installation={{
              id: item.id,
              name: item.name,
              hostname: item.hostname,
              status: item.status,
              productKey: item.product.key,
            }}
          />
        ))}
    </main>
  )
}
