'use client'

import { useState } from 'react'
import Link from 'next/link'
import { moduleIds, validateModules, type ModuleId, type SaaSAccess } from '@/lib/saas/catalog'
import dependencies from '@/config/saas-modules.json'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const starter: ModuleId[] = ['core', 'patients', 'appointments', 'clinical']
const practice: ModuleId[] = [...starter, 'billing']

export function ClinicManager({ initial }: { initial: SaaSAccess[] }) {
  const [clinics, setClinics] = useState(initial)
  const [selectedId, setSelectedId] = useState(initial[0]?.tenantId || '')
  const selected = clinics.find((clinic) => clinic.tenantId === selectedId)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function request(path: string, method: string, body: unknown) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/saas-admin/${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(
          typeof result.detail === 'string'
            ? result.detail
            : JSON.stringify(result.detail || result.error)
        )
      const refreshed = await fetch('/api/saas-admin/tenants', { cache: 'no-store' })
      if (!refreshed.ok) throw new Error('Saved, but refresh failed. Reload before another change.')
      setClinics((await refreshed.json()).tenants)
      setMessage(
        'Saved. Hosted changes apply on the next request; offline changes require a newer license.'
      )
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Change failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/owner" className="text-sm underline">
          Product operations
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Clinic subscriptions</h1>
        <p className="mt-2 text-slate-600">
          Assign modules, verify payments, manage clinic branding and operational access.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">
          {message}
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clinics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {clinics.length === 0 && <p>No clinics registered yet.</p>}
              {clinics.map((clinic) => (
                <button
                  key={clinic.tenantId}
                  onClick={() => setSelectedId(clinic.tenantId)}
                  className={`w-full rounded-xl border p-3 text-left ${selectedId === clinic.tenantId ? 'border-blue-500 bg-blue-50' : ''}`}
                >
                  <strong className="block">{clinic.name}</strong>
                  <span className="text-xs">
                    {clinic.state} · {clinic.mode}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
          <details className="rounded-xl border bg-white p-4">
            <summary className="cursor-pointer font-semibold">Register clinic</summary>
            <form
              className="mt-4 space-y-3"
              onSubmit={async (event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                const created = await request('tenants', 'POST', {
                  id: data.get('id'),
                  name: data.get('name'),
                  slug: data.get('slug'),
                  hostname: data.get('hostname') || null,
                  customerId: data.get('customerId'),
                  accessUntil: new Date(String(data.get('accessUntil'))).toISOString(),
                  modules: starter,
                  mode: data.get('mode'),
                  planName: 'Starter',
                  branding: {},
                  monthlyFee: String(data.get('monthlyFee') || '0'),
                })
                if (created) setSelectedId(created.tenantId)
              }}
            >
              <p className="text-xs text-slate-600">
                Use the clinic ID from its provisioned installation. Registration does not copy
                patient data.
              </p>
              {['id', 'name', 'slug', 'hostname', 'customerId'].map((name) => (
                <label key={name} className="block text-sm">
                  {name}
                  <Input name={name} required={name !== 'hostname'} />
                </label>
              ))}
              <label className="block text-sm">
                Access until (local time)
                <Input type="datetime-local" name="accessUntil" required />
              </label>
              <label className="block text-sm">
                Monthly fee (ETB)
                <Input type="number" min="0" step="0.01" name="monthlyFee" defaultValue="0" />
              </label>
              <label className="block text-sm">
                Delivery
                <select name="mode" className="block w-full rounded border p-2">
                  <option value="hosted">Hosted</option>
                  <option value="offline">Offline</option>
                </select>
              </label>
              <Button disabled={busy}>Register Starter clinic</Button>
            </form>
          </details>
        </div>
        {selected && (
          <div key={`${selected.tenantId}:${selected.revision}`} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{selected.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    Clinic ID: <code>{selected.tenantId}</code>
                  </div>
                  <div>
                    State: <strong>{selected.state}</strong>
                  </div>
                  <div>
                    Paid through:{' '}
                    {selected.accessUntil
                      ? new Date(selected.accessUntil).toLocaleString()
                      : 'Unset'}
                  </div>
                  <div>
                    Grace until:{' '}
                    {selected.graceUntil ? new Date(selected.graceUntil).toLocaleString() : 'None'}
                  </div>
                  <div>Domain: {selected.hostname || 'Unassigned'}</div>
                  <div>Policy revision: {selected.revision}</div>
                </dl>
                {selected.mode === 'offline' && (
                  <p className="mt-4 rounded bg-amber-50 p-3 text-sm">
                    Offline changes require a newer signed license delivered online or by USB.
                    Disconnected installs enforce existing license expiry.
                  </p>
                )}
              </CardContent>
            </Card>
            <ModulesEditor
              key={selected.revision}
              clinic={selected}
              busy={busy}
              save={(modules, effectiveAt) =>
                request(`tenants/${selected.tenantId}/modules`, 'PUT', {
                  modules,
                  effectiveAt,
                  revision: selected.revision,
                })
              }
            />
            <Card>
              <CardHeader>
                <CardTitle>Record verified monthly payment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-slate-600">
                  Verify receipt first. Duplicate references are idempotent. Payment extends
                  calendar months; suspended clinics need explicit restoration.
                </p>
                <form
                  className="grid gap-3 sm:grid-cols-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const data = new FormData(event.currentTarget)
                    void request(`tenants/${selected.tenantId}/renew`, 'POST', {
                      reference: data.get('reference'),
                      amount: data.get('amount'),
                      months: Number(data.get('months')),
                      currency: 'ETB',
                    })
                  }}
                >
                  <label className="text-sm">
                    Receipt/reference
                    <Input name="reference" required minLength={3} />
                  </label>
                  <label className="text-sm">
                    Amount (ETB)
                    <Input
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      defaultValue={selected.monthlyFee === '0' ? '' : selected.monthlyFee}
                    />
                  </label>
                  <label className="text-sm">
                    Months
                    <Input name="months" type="number" min="1" max="12" required defaultValue="1" />
                  </label>
                  <Button disabled={busy}>Verify and renew</Button>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Operational access</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const data = new FormData(event.currentTarget)
                    void request(`tenants/${selected.tenantId}/suspension`, 'PUT', {
                      revision: selected.revision,
                      suspended: selected.status !== 'suspended',
                      reason: data.get('reason'),
                    })
                  }}
                >
                  <label className="min-w-64 flex-1 text-sm">
                    Audit reason
                    <Input name="reason" required minLength={3} />
                  </label>
                  <Button
                    variant={selected.status === 'suspended' ? 'default' : 'destructive'}
                    disabled={busy}
                  >
                    {selected.status === 'suspended' ? 'Restore writes' : 'Suspend writes'}
                  </Button>
                </form>
                <p className="mt-3 text-sm text-slate-600">
                  Record viewing, backup/export, audit and renewal remain available. Restoration
                  still respects subscription expiry.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Clinic branding</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const data = new FormData(event.currentTarget)
                    void request(`tenants/${selected.tenantId}/branding`, 'PUT', {
                      revision: selected.revision,
                      branding: Object.fromEntries(data),
                    })
                  }}
                >
                  {[
                    'displayName',
                    'nameAm',
                    'logo',
                    'primaryColor',
                    'contactEmail',
                    'contactPhone',
                    'address',
                    'renewalContact',
                  ].map((name) => (
                    <label key={name} className="text-sm">
                      {name}
                      <Input
                        name={name}
                        defaultValue={
                          selected.branding[name as keyof SaaSAccess['branding']] ||
                          (name === 'primaryColor' ? '#0769e7' : '')
                        }
                      />
                    </label>
                  ))}
                  <Button disabled={busy}>Save clinic branding</Button>
                </form>
              </CardContent>
            </Card>
            {selected.mode === 'offline' && (
              <Card>
                <CardHeader>
                  <CardTitle>Issue offline license</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm">
                    Upload the activation request from this installation. License contains current
                    module grants and paid-through expiry; no patient data.
                  </p>
                  <input
                    aria-label="Activation request file"
                    type="file"
                    accept=".json,application/json"
                    disabled={busy}
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      if (!file || file.size > 65536) {
                        setError('Choose an activation request under 64 KB')
                        return
                      }
                      const document = await request(
                        `tenants/${selected.tenantId}/license`,
                        'POST',
                        { activationRequest: await file.text() }
                      )
                      if (!document) return
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(document)], { type: 'application/json' })
                      )
                      const link = documentDownload(url, `${selected.slug}.lic`)
                      link.click()
                      setTimeout(() => URL.revokeObjectURL(url), 1000)
                    }}
                  />
                </CardContent>
              </Card>
            )}
            <AuditHistory tenantId={selected.tenantId} revision={selected.revision} />
          </div>
        )}
      </div>
    </div>
  )
}

function documentDownload(url: string, name: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = name
  return link
}

function ModulesEditor({
  clinic,
  busy,
  save,
}: {
  clinic: SaaSAccess
  busy: boolean
  save: (modules: ModuleId[], effectiveAt: string | null) => Promise<unknown>
}) {
  const [modules, setModules] = useState(clinic.modules)
  const [when, setWhen] = useState('period-end')
  let validation = ''
  try {
    validateModules(modules)
  } catch (error) {
    validation = String(error)
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Modules and packages</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ['Starter', starter],
            ['Practice', practice],
            ['All modules', moduleIds],
          ].map(([name, ids]) => (
            <Button
              type="button"
              variant="outline"
              key={String(name)}
              onClick={() => setModules(ids as ModuleId[])}
            >
              {String(name)}
            </Button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {moduleIds.map((id) => (
            <label key={id} className="rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                disabled={id === 'core'}
                checked={modules.includes(id)}
                onChange={(event) =>
                  setModules(
                    event.target.checked ? [...modules, id] : modules.filter((key) => key !== id)
                  )
                }
              />{' '}
              <strong>{id}</strong>
              <span className="mt-1 block text-xs text-slate-500">
                Requires: {dependencies[id].join(', ') || 'Included'}
              </span>
            </label>
          ))}
        </div>
        {validation && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {validation}
          </p>
        )}
        {clinic.scheduledAt && (
          <p className="mt-3 text-sm">
            Scheduled: {clinic.scheduledModules?.join(', ')} on{' '}
            {new Date(clinic.scheduledAt).toLocaleString()}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <select
            aria-label="When modules change"
            className="rounded border p-2"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
          >
            <option value="period-end">Next period boundary</option>
            <option value="now">Immediately</option>
          </select>
          <Button
            disabled={busy || Boolean(validation)}
            onClick={() => save(modules, when === 'period-end' ? clinic.accessUntil : null)}
          >
            Save module allocation
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AuditHistory({ tenantId, revision }: { tenantId: string; revision: number }) {
  const [events, setEvents] = useState<
    Array<{ id: string; actor: string; action: string; createdAt: string }>
  >([])
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit history</CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          onClick={async () => {
            const response = await fetch(
              `/api/saas-admin/tenants/${tenantId}/history?revision=${revision}`
            )
            if (response.ok) setEvents((await response.json()).events)
          }}
        >
          Load recent events
        </Button>
        <ul className="mt-4 space-y-2 text-sm">
          {events.map((event) => (
            <li key={event.id}>
              {new Date(event.createdAt).toLocaleString()} · {event.action} · {event.actor}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
