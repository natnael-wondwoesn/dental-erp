import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ownerFetch, type Deployment, type Overview } from '@/lib/saas/admin'

export const dynamic = 'force-dynamic'

const tone = { SUCCEEDED: 'default', FAILED: 'destructive', ROLLED_BACK: 'secondary' } as const

export default async function ReleasesPage() {
  const [overview, history] = await Promise.all([
    ownerFetch<Overview>('overview'),
    ownerFetch<{ deployments: Deployment[]; total: number }>('deployments'),
  ])
  if (!overview || !history)
    return (
      <section className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Releases</h1>
        <p className="mt-3">SaaS control is unavailable. Try again shortly.</p>
      </section>
    )
  return (
    <div className="space-y-6">
      <div>
        <Link href="/owner" className="text-sm underline">
          Product operations
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Releases</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Pushing a version tag builds the release and rolls it out automatically to the control
          platform first, then each client site in turn. Every rollout is recorded here with its
          result. Failed rollouts restore the previous version on their own.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Version running on each site</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {overview.versions.length === 0 && (
            <p className="text-sm text-slate-500">
              No rollouts recorded yet. The next tagged release will appear here.
            </p>
          )}
          {overview.versions.map((row) => (
            <div key={row.client} className="rounded-lg border p-3">
              <div className="font-medium">{row.client}</div>
              <div className="mt-1 text-2xl font-semibold">{row.version}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <Badge variant={tone[row.status as keyof typeof tone] ?? 'secondary'}>
                  {row.status}
                </Badge>
                {new Date(row.at).toLocaleString()}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rollout history ({history.total})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">When</th>
                <th className="p-2">Site</th>
                <th className="p-2">Version</th>
                <th className="p-2">From</th>
                <th className="p-2">Result</th>
                <th className="p-2">Run</th>
              </tr>
            </thead>
            <tbody>
              {history.deployments.map((row) => (
                <tr key={row.id} className="border-b align-top">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="p-2">{row.client}</td>
                  <td className="p-2 font-medium">{row.version}</td>
                  <td className="p-2 text-slate-500">{row.previousVersion || '—'}</td>
                  <td className="p-2">
                    <Badge variant={tone[row.status]}>{row.status}</Badge>
                    {row.detail && <div className="mt-1 text-xs text-slate-500">{row.detail}</div>}
                  </td>
                  <td className="p-2">
                    {row.runUrl ? (
                      <a className="underline" href={row.runUrl} rel="noreferrer" target="_blank">
                        View
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
