'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { AuditEvent } from '@/lib/saas/admin'

export function AuditLog({ events }: { events: AuditEvent[] }) {
  const [action, setAction] = useState('')
  const [text, setText] = useState('')
  const actions = useMemo(() => [...new Set(events.map((e) => e.action))].sort(), [events])
  const shown = events.filter(
    (event) =>
      (!action || event.action === action) &&
      `${event.tenantName} ${event.actor} ${JSON.stringify(event.details)}`
        .toLowerCase()
        .includes(text.toLowerCase())
  )
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            Action
            <select
              value={action}
              onChange={(event) => setAction(event.target.value)}
              className="mt-1 block h-10 rounded-md border border-input px-3"
            >
              <option value="">All</option>
              {actions.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Search
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Clinic, person or detail"
              className="mt-1 block h-10 rounded-md border border-input px-3"
            />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Showing {shown.length} of {events.length} events
        </p>
        <ul className="divide-y">
          {shown.map((event) => (
            <li key={event.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{event.action}</Badge>
                <strong>{event.tenantName}</strong>
                <span className="text-slate-500">
                  by {event.actor} · {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
              <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-xs">
                {JSON.stringify(event.details, null, 1)}
              </pre>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
