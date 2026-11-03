'use client'

import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { moduleIds, type SaaSAccess } from '@/lib/saas/catalog'
import type { Overview } from '@/lib/saas/admin'

const stateTone = (state: string) =>
  state === 'active' ? 'default' : state === 'suspended' ? 'destructive' : 'secondary'

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? '')
  // Leading = + - @ would be run as a formula by spreadsheet apps.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

export function FleetConsole({ overview, initial }: { overview: Overview; initial: SaaSAccess[] }) {
  const [clinics, setClinics] = useState(initial)
  const [selected, setSelected] = useState<string[]>([])
  const [moduleId, setModuleId] = useState<string>(moduleIds.includes('braces') ? 'braces' : 'core')
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const visible = useMemo(
    () =>
      clinics.filter((clinic) =>
        `${clinic.name} ${clinic.hostname ?? ''} ${clinic.planName}`
          .toLowerCase()
          .includes(filter.toLowerCase())
      ),
    [clinics, filter]
  )

  async function apply(mode: 'add' | 'remove') {
    if (selected.length === 0) return setError('Select at least one clinic first.')
    if (
      !confirm(
        `${mode === 'add' ? 'Add' : 'Remove'} "${moduleId}" for ${selected.length} clinic(s)?`
      )
    )
      return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/saas-admin/modules/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantIds: selected,
          add: mode === 'add' ? [moduleId] : [],
          remove: mode === 'remove' ? [moduleId] : [],
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(typeof result.detail === 'string' ? result.detail : 'Change failed')
      const refreshed = await fetch('/api/saas-admin/tenants', { cache: 'no-store' })
      if (refreshed.ok) setClinics((await refreshed.json()).tenants)
      const changed = (result.results as { changed: boolean }[]).filter((row) => row.changed).length
      setMessage(`${changed} clinic(s) changed, ${selected.length - changed} already matched.`)
      setSelected([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Change failed')
    } finally {
      setBusy(false)
    }
  }

  function exportCsv() {
    const header = ['Clinic', 'Hostname', 'Plan', 'State', 'Access until', 'Monthly fee', 'Modules']
    const rows = clinics.map((clinic) => [
      clinic.name,
      clinic.hostname,
      clinic.planName,
      clinic.state,
      clinic.accessUntil,
      clinic.monthlyFee,
      clinic.modules.join(' '),
    ])
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'clinics.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Clinics" value={overview.tenants} />
        <Stat
          label="Monthly recurring"
          value={`${overview.currency} ${Number(overview.monthlyRecurring).toLocaleString()}`}
        />
        <Stat
          label="By state"
          value={
            Object.entries(overview.byState)
              .map(([state, count]) => `${count} ${state}`)
              .join(' · ') || 'None'
          }
        />
        <Stat label="Expiring in 14 days" value={overview.expiringSoon.length} />
      </div>

      {overview.expiringSoon.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Renewals due soon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {overview.expiringSoon.map((row) => (
              <div key={row.tenantId}>
                <strong>{row.name}</strong> — {new Date(row.accessUntil).toLocaleDateString()}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Module matrix</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Find clinic
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Name, domain or plan"
                className="mt-1 block h-10 rounded-md border border-input px-3"
              />
            </label>
            <label className="text-sm">
              Module
              <select
                value={moduleId}
                onChange={(event) => setModuleId(event.target.value)}
                className="mt-1 block h-10 rounded-md border border-input px-3"
              >
                {moduleIds
                  .filter((id) => id !== 'core')
                  .map((id) => (
                    <option key={id} value={id}>
                      {id} ({overview.moduleAdoption[id] ?? 0})
                    </option>
                  ))}
              </select>
            </label>
            <Button disabled={busy} onClick={() => apply('add')}>
              Add to selected
            </Button>
            <Button disabled={busy} variant="outline" onClick={() => apply('remove')}>
              Remove from selected
            </Button>
            <Button variant="ghost" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          {message && <p className="text-sm text-green-700">{message}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">
                    <input
                      type="checkbox"
                      aria-label="Select all clinics"
                      checked={
                        visible.length > 0 && visible.every((c) => selected.includes(c.tenantId))
                      }
                      onChange={(event) =>
                        setSelected(event.target.checked ? visible.map((c) => c.tenantId) : [])
                      }
                    />
                  </th>
                  <th className="p-2">Clinic</th>
                  <th className="p-2">State</th>
                  {moduleIds.map((id) => (
                    <th key={id} className="p-1 text-xs font-medium [writing-mode:vertical-rl]">
                      {id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((clinic) => (
                  <tr key={clinic.tenantId} className="border-b">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${clinic.name}`}
                        checked={selected.includes(clinic.tenantId)}
                        onChange={(event) =>
                          setSelected(
                            event.target.checked
                              ? [...selected, clinic.tenantId]
                              : selected.filter((id) => id !== clinic.tenantId)
                          )
                        }
                      />
                    </td>
                    <td className="p-2">
                      <div className="font-medium">{clinic.name}</div>
                      <div className="text-xs text-slate-500">{clinic.hostname || 'No domain'}</div>
                    </td>
                    <td className="p-2">
                      <Badge variant={stateTone(clinic.state)}>{clinic.state}</Badge>
                    </td>
                    {moduleIds.map((id) => (
                      <td key={id} className="p-1 text-center">
                        {clinic.modules.includes(id) ? '●' : '·'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-slate-500">{label}</div>
        <div className="mt-1 text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  )
}
