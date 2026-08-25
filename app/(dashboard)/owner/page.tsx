import { notFound } from 'next/navigation'
import {
  Activity,
  Boxes,
  Building2,
  CalendarClock,
  DatabaseBackup,
  RefreshCcw,
  Rocket,
  ShieldCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { prisma } from '@/lib/prisma'
import { normalizedFeatures, requirePlatformOwner } from '@/lib/platform-control'
import {
  checkInstallationHealth,
  createCustomer,
  createInstallation,
  deployInstallationVersion,
  queueOperation,
  setHandwritingEntitlement,
} from './actions'

const fieldClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm'

function statusVariant(status: string) {
  if (['RUNNING', 'HEALTHY', 'SUCCEEDED'].includes(status)) return 'default' as const
  if (['DEGRADED', 'FAILED', 'UNREACHABLE'].includes(status)) return 'destructive' as const
  return 'secondary' as const
}

export default async function OwnerConsolePage() {
  const session = await requirePlatformOwner()
  if (!session) notFound()

  const [customers, products, installations, operations] = await Promise.all([
    prisma.platformCustomer.findMany({ orderBy: { name: 'asc' } }),
    prisma.platformProduct.findMany({ orderBy: { name: 'asc' } }),
    prisma.platformInstallation.findMany({
      include: { customer: true, product: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.platformOperation.findMany({
      include: { installation: true, requestedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
  ])

  const healthy = installations.filter((item) => item.lastHealthStatus === 'HEALTHY').length
  const expiring = installations.filter((item) => {
    if (!item.licenseExpiresAt) return false
    const days = (item.licenseExpiresAt.getTime() - Date.now()) / 86_400_000
    return days >= 0 && days <= 10
  }).length

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <ShieldCheck className="h-4 w-4" /> Platform owner only
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Product operations</h1>
        <p className="text-muted-foreground">
          Customers, installations, feature entitlements, licensing, health, backups, and releases.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          [Building2, 'Customers', customers.length],
          [Boxes, 'Installations', installations.length],
          [Activity, 'Healthy now', `${healthy}/${installations.length}`],
          [CalendarClock, 'Licenses due in 10 days', expiring],
        ].map(([Icon, label, value]) => {
          const IconComponent = Icon as typeof Building2
          return (
            <Card key={String(label)}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-lg bg-primary/10 p-3">
                  <IconComponent className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{String(label)}</p>
                  <p className="text-2xl font-semibold">{String(value)}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add customer</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createCustomer} className="grid gap-3 md:grid-cols-2">
              <input
                className={fieldClass}
                name="name"
                placeholder="Clinic or company name"
                required
              />
              <input
                className={fieldClass}
                name="slug"
                placeholder="customer-slug"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
              <input className={fieldClass} name="contactName" placeholder="Contact person" />
              <input className={fieldClass} name="contactPhone" placeholder="+251..." />
              <input
                className={`${fieldClass} md:col-span-2`}
                name="contactEmail"
                type="email"
                placeholder="contact@example.com"
              />
              <textarea
                className="min-h-20 rounded-md border border-input bg-background p-3 text-sm md:col-span-2"
                name="notes"
                placeholder="Commercial or support notes"
              />
              <Button type="submit" className="md:col-span-2">
                Save customer
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create isolated installation</CardTitle>
          </CardHeader>
          <CardContent>
            {customers.length && products.length ? (
              <form action={createInstallation} className="grid gap-3 md:grid-cols-2">
                <select className={fieldClass} name="customerId" required>
                  {customers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <select className={fieldClass} name="productId" required>
                  {products.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <input
                  className={fieldClass}
                  name="name"
                  placeholder="Production Dental ERP"
                  required
                />
                <input
                  className={fieldClass}
                  name="slug"
                  placeholder="clinic-production"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                />
                <input
                  className={`${fieldClass} md:col-span-2`}
                  name="hostname"
                  placeholder="clinic.example.com"
                  required
                />
                <input
                  className={fieldClass}
                  name="version"
                  placeholder="Exact release tag, e.g. 1.2.0"
                  required
                />
                <input className={fieldClass} name="licenseExpiresAt" type="date" />
                <Button type="submit" className="md:col-span-2">
                  <Rocket className="mr-2 h-4 w-4" />
                  Create and queue provisioning
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Create a customer and seed the product catalog first.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Installations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {installations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No installations registered yet.</p>
          ) : (
            installations.map((installation) => {
              const features = normalizedFeatures(installation.features)
              return (
                <div key={installation.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{installation.name}</h3>
                        <Badge variant={statusVariant(installation.status)}>
                          {installation.status}
                        </Badge>
                        <Badge variant="outline">{installation.product.name}</Badge>
                        {!installation.managedByWorker && (
                          <Badge variant="secondary">Inventory only</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {installation.customer.name} · {installation.hostname} ·{' '}
                        {installation.version || 'version not pinned'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Health: {installation.lastHealthStatus || 'not checked'}
                        {installation.lastHealthAt
                          ? ` · ${installation.lastHealthAt.toLocaleString()}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <form action={checkInstallationHealth}>
                        <input type="hidden" name="installationId" value={installation.id} />
                        <Button size="sm" variant="outline">
                          <RefreshCcw className="mr-1 h-4 w-4" />
                          Health
                        </Button>
                      </form>
                      {installation.managedByWorker &&
                        (['RESTART', 'BACKUP'] as const).map((action) => (
                          <form action={queueOperation} key={action}>
                            <input type="hidden" name="installationId" value={installation.id} />
                            <input type="hidden" name="action" value={action} />
                            <Button size="sm" variant="outline">
                              {action === 'BACKUP' ? (
                                <DatabaseBackup className="mr-1 h-4 w-4" />
                              ) : (
                                <RefreshCcw className="mr-1 h-4 w-4" />
                              )}
                              {action.toLowerCase()}
                            </Button>
                          </form>
                        ))}
                    </div>
                  </div>
                  {installation.managedByWorker && (
                    <form
                      action={deployInstallationVersion}
                      className="mt-4 flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-end"
                    >
                      <input type="hidden" name="installationId" value={installation.id} />
                      <label className="flex-1 text-xs font-medium text-muted-foreground">
                        Release version
                        <input
                          className={`${fieldClass} mt-1`}
                          name="version"
                          defaultValue={installation.version || ''}
                          placeholder="Exact release tag"
                          required
                        />
                      </label>
                      <Button size="sm" type="submit">
                        <Rocket className="mr-1 h-4 w-4" />
                        Deploy release
                      </Button>
                    </form>
                  )}
                  {installation.product.key === 'dental-erp' && (
                    <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 p-3">
                      <div>
                        <p className="text-sm font-medium">Tablet handwritten diagnosis</p>
                        <p className="text-xs text-muted-foreground">
                          Pressure-aware S Pen notes; disabled by default.
                        </p>
                      </div>
                      {installation.managedByWorker ? (
                        <form action={setHandwritingEntitlement}>
                          <input type="hidden" name="installationId" value={installation.id} />
                          <input
                            type="hidden"
                            name="enabled"
                            value={features.handwrittenDiagnosis ? 'false' : 'true'}
                          />
                          <Button
                            size="sm"
                            variant={features.handwrittenDiagnosis ? 'default' : 'outline'}
                          >
                            {features.handwrittenDiagnosis ? 'Enabled' : 'Enable'}
                          </Button>
                        </form>
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground">
                          {features.handwrittenDiagnosis ? 'Enabled manually' : 'Disabled manually'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent operations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {operations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No operations queued.</p>
            ) : (
              operations.map((operation) => (
                <div
                  key={operation.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{operation.action}</span> ·{' '}
                    {operation.installation?.name || 'Removed installation'}{' '}
                    <span className="text-muted-foreground">by {operation.requestedBy.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(operation.status)}>{operation.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {operation.createdAt.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
