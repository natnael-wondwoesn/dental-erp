'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { productUserRoles } from '@/lib/platform-owner-operations'

type User = {
  id: string
  name: string
  email: string
  role: string
  roles?: string[]
  isActive: boolean
}
type Operation = {
  id: string
  status: string
  error?: string
  result?: {
    message?: string
    users?: User[]
    user?: User
    databaseRunning?: boolean
    databaseHealth?: string
    seeded?: boolean
    removed?: boolean
    counts?: Record<string, number>
  }
}
const field = 'w-full rounded-md border bg-background px-3 py-2 text-sm'

export function InstallationControls({
  installation,
}: {
  installation: { id: string; name: string; hostname: string; productKey: string; status: string }
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [users, setUsers] = useState<User[] | null>(null)
  const [password, setPassword] = useState<{ email: string; password: string } | null>(null)
  const [database, setDatabase] = useState<boolean | undefined>(
    installation.status === 'DATABASE_STOPPED' ? false : undefined
  )
  const [reason, setReason] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [roles, setRoles] = useState<Record<string, string>>({})
  const availableRoles = productUserRoles[installation.productKey] || []
  const endpoint = `/api/platform/installations/${installation.id}/operations`
  const initialized = useRef(false)

  async function run(input: Record<string, unknown>) {
    setBusy(true)
    setMessage('Operation queued…')
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const queued = await response.json()
      if (!response.ok) throw new Error(queued.error || 'Unable to queue operation')
      let operation: Operation = queued
      for (let attempt = 0; attempt < 120; attempt++) {
        if (operation.status === 'SUCCEEDED' || operation.status === 'FAILED') break
        await new Promise((resolve) => setTimeout(resolve, 1000))
        const poll = await fetch(`${endpoint}?operationId=${encodeURIComponent(queued.id)}`, {
          cache: 'no-store',
        })
        if (!poll.ok) throw new Error('Unable to read operation status; check operation history')
        operation = await poll.json()
      }
      if (operation.status === 'FAILED') throw new Error(operation.error || 'Operation failed')
      if (operation.status !== 'SUCCEEDED')
        throw new Error('Operation still running. Check history before retrying.')
      const result = operation.result || {}
      if (result.users) setUsers(result.users)
      if (result.user) {
        setUsers((previous) =>
          previous
            ? [...previous.filter((user) => user.id !== result.user!.id), result.user!]
            : [result.user!]
        )
        if (queued.temporaryPassword)
          setPassword({ email: String(input.email), password: queued.temporaryPassword })
      }
      if (typeof result.databaseRunning === 'boolean') setDatabase(result.databaseRunning)
      setMessage(result.message || 'Operation completed')
      if (input.action === 'DB_STOP') setConfirmation('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Operation failed')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    void (async () => {
      await run({ action: 'STATUS' })
      await run({ action: 'USER_LIST' })
    })()
    // The installation ID is immutable for this mounted card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint])
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    void run({
      action: 'USER_CREATE',
      name: data.get('name'),
      email: data.get('email'),
      role: data.get('role'),
      reason,
    })
  }
  return (
    <section className="rounded-xl border bg-white p-5 space-y-5">
      <div>
        <h2 className="text-xl font-semibold">{installation.name}</h2>
        <p className="text-sm text-slate-600">
          {installation.hostname} · {installation.productKey}
        </p>
      </div>
      <p role="status" className="text-sm">
        {message}
      </p>
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-semibold">
          Database:{' '}
          {database === undefined
            ? 'not checked'
            : database
              ? 'running'
              : 'stopped — clinic offline'}
        </h3>
        <p className="text-sm text-slate-600">
          Stopping the database takes this clinic offline. Stored records remain intact. Start it
          here to restore database service.
        </p>
        <Button variant="outline" disabled={busy} onClick={() => void run({ action: 'STATUS' })}>
          Refresh database status
        </Button>
        <label className="block text-sm">
          Reason for account or database change
          <input
            className={field}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="Explain this change for the audit history"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Required for every change. Enter at least 3 characters; saved in audit history.
          </span>
        </label>
        <label className="block text-sm">
          To stop, type {installation.hostname}
          <input
            className={field}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="destructive"
            disabled={
              busy ||
              reason.trim().length < 3 ||
              confirmation !== installation.hostname ||
              database === false
            }
            onClick={() => void run({ action: 'DB_STOP', confirmHostname: confirmation, reason })}
          >
            Stop database
          </Button>
          <Button
            disabled={busy || reason.trim().length < 3 || database === true}
            onClick={() => void run({ action: 'DB_START', reason })}
          >
            Start database
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Stop requires running database, audit reason, and exact hostname. Start requires stopped
          database and audit reason.
        </p>
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Clinic administrators and staff</h3>
          <Button
            variant="outline"
            disabled={busy || database === false}
            onClick={() => void run({ action: 'USER_LIST' })}
          >
            Load users
          </Button>
        </div>
        {users?.length === 0 && <p className="text-sm">No clinic users found.</p>}
        {users?.map((user) => (
          <div className="rounded-lg border p-3 space-y-2" key={user.id}>
            <p className="font-medium">
              {user.name} · {user.isActive ? 'Active' : 'Disabled'}
            </p>
            <p className="text-sm text-slate-600">
              {user.email} · {user.roles?.join(', ') || user.role}
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                aria-label={`New role for ${user.email}`}
                className={field + ' sm:w-auto'}
                value={roles[user.id] || ''}
                onChange={(event) =>
                  setRoles((previous) => ({ ...previous, [user.id]: event.target.value }))
                }
              >
                <option value="">Choose new role</option>
                {availableRoles.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || reason.trim().length < 3 || !roles[user.id] || database === false}
                onClick={() =>
                  void run({ action: 'USER_UPDATE', userId: user.id, role: roles[user.id], reason })
                }
              >
                Apply role
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || reason.trim().length < 3 || database === false}
                onClick={() =>
                  void run({
                    action: 'USER_UPDATE',
                    userId: user.id,
                    isActive: !user.isActive,
                    reason,
                  })
                }
              >
                {user.isActive ? 'Disable user' : 'Enable user'}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Role and enable/disable changes use audit reason above.
            </p>
          </div>
        ))}
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 rounded-lg border p-4">
          <h4 className="sm:col-span-2 font-medium">Create clinic account</h4>
          <input
            aria-label="New user name"
            className={field}
            name="name"
            placeholder="Full name"
            minLength={2}
            maxLength={120}
            required
          />
          <input
            aria-label="New user email"
            className={field}
            name="email"
            placeholder="Login email"
            type="email"
            required
          />
          <select aria-label="New user role" className={field} name="role" required defaultValue="">
            <option value="" disabled>
              Choose role
            </option>
            {availableRoles.map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
          <Button disabled={busy || reason.trim().length < 3 || database === false}>
            Create account
          </Button>
          <p className="text-xs text-slate-600 sm:col-span-2">
            Complete name, email, role, and audit reason above. A temporary password appears once
            after creation. No email is sent. Clinic accounts cannot access this owner console.
          </p>
        </form>
        {password && (
          <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 space-y-2">
            <p className="font-semibold">Account created — copy temporary password now</p>
            <p>{password.email}</p>
            <code className="break-all select-all">{password.password}</code>
            <p className="text-xs">
              Share privately with this clinic’s authorized user. This password is not saved in
              operation history.
            </p>
            <Button size="sm" variant="outline" onClick={() => setPassword(null)}>
              Hide password
            </Button>
          </div>
        )}
      </div>
      {installation.productKey === 'dental-erp' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-3">
          <h3 className="font-semibold">Clinic demo data</h3>
          <p className="text-sm text-slate-600">
            Seed realistic synthetic records across patients, appointments, clinical work, billing,
            laboratory, inventory, prescriptions, recalls, and sterilization. Removing demo data
            deletes only records carrying the reserved demo identifiers; clinic records remain
            untouched.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || database === false || reason.trim().length < 3}
              onClick={() => void run({ action: 'DEMO_SEED', reason })}
            >
              Seed demo data
            </Button>
            <Button
              variant="destructive"
              disabled={busy || database === false || reason.trim().length < 3}
              onClick={() => void run({ action: 'DEMO_RESET', reason })}
            >
              Remove demo data
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Uses the audit reason above. Seed is repeatable; running it again refreshes the demo
            dataset. Removal never targets records outside this clinic or without demo IDs.
          </p>
        </div>
      )}
    </section>
  )
}
