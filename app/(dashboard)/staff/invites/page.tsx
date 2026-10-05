'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, MailPlus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Invite = {
  id: string
  email: string
  name: string
  role: string
  status: string
  expiresAt: string
  createdAt: string
}

export default function StaffInvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'DOCTOR' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/staff-invites')
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to load staff invites')
      setInvites(result.invites || [])
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to load staff invites')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch('/api/staff-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to create invite')
      toast.success(result.message || 'Invite created')
      setForm({ name: '', email: '', role: 'DOCTOR' })
      await load()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to create invite')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/staff">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Staff invitations</h1>
          <p className="text-muted-foreground">Invite clinic staff and track acceptance.</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailPlus className="h-5 w-5" />
              New invitation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  required
                  minLength={2}
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(role) => setForm({ ...form, role })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DOCTOR">Doctor</SelectItem>
                    <SelectItem value="RECEPTIONIST">Receptionist</SelectItem>
                    <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                    <SelectItem value="LAB_TECH">Lab technician</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send invitation
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Invitation history</CardTitle>
              <Button variant="ghost" size="icon" onClick={load}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Loading invitations…</p>}
            {!loading && invites.length === 0 && (
              <p className="text-sm text-muted-foreground">No invitations yet.</p>
            )}
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{invite.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {invite.email} · {invite.role.replaceAll('_', ' ')}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="outline">{invite.status}</Badge>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Expires {new Date(invite.expiresAt).toLocaleDateString('en-ET')}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
