'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [required, setRequired] = useState(false)
  useEffect(() => {
    setRequired(new URLSearchParams(window.location.search).get('required') === '1')
  }, [])
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    if (newPassword !== confirm) {
      setMessage({ ok: false, text: 'The new passwords do not match' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Unable to change password')
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
      setMessage({ ok: true, text: 'Password changed. Use it the next time you sign in.' })
      // Reload so the "must change password" lock is lifted everywhere.
      if (required) window.location.assign('/dashboard')
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Failed' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto max-w-lg p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Change password
          </CardTitle>
          <CardDescription>
            {required && (
              <strong className="mb-2 block text-amber-700">
                You are signing in with a temporary password. Choose your own password to continue.
              </strong>
            )}
            Change the password for your own account. Use at least 10 characters with a letter and a
            number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">
                {required ? 'Temporary password' : 'Current password'}
              </Label>
              <Input
                id="current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">New password</Label>
              <Input
                id="new"
                type="password"
                autoComplete="new-password"
                minLength={10}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            {message && (
              <p
                role="status"
                className={message.ok ? 'text-sm text-green-700' : 'text-sm text-red-600'}
              >
                {message.text}
              </p>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Change password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
