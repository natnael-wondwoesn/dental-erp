'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTenantAccess } from './tenant-access'

export function SaaSSubscription() {
  const access = useTenantAccess()
  const [licenseMessage, setLicenseMessage] = useState('')
  if (!access) return null
  return (
    <section className="max-w-3xl space-y-5 rounded-2xl border bg-white p-6">
      <h1 className="text-2xl font-semibold">Clinic subscription</h1>
      <p>
        {access.branding.displayName || access.name} · {access.planName}
      </p>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          Access: <strong>{access.state}</strong>
        </div>
        <div>
          Monthly fee: {access.monthlyFee || '—'} {access.currency || 'ETB'}
        </div>
        <div>
          Paid through:{' '}
          {access.accessUntil ? new Date(access.accessUntil).toLocaleString() : 'Unavailable'}
        </div>
        <div>
          Grace until: {access.graceUntil ? new Date(access.graceUntil).toLocaleString() : 'None'}
        </div>
      </dl>
      <div>
        <h2 className="font-semibold">Included modules</h2>
        <p className="mt-2">{access.modules.join(', ') || 'Recovery only'}</p>
      </div>
      <p>
        {access.branding.renewalContact ||
          'Contact your software provider to verify payment, renew or change modules.'}
      </p>
      {access.mode === 'offline' && (
        <div>
          <p>Import the signed renewal file supplied by your software provider.</p>
          <input
            aria-label="Signed license file"
            type="file"
            accept=".lic,.json,application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file || file.size > 65536) return
              try {
                const response = await fetch('/api/license/import', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: await file.text(),
                })
                if (!response.ok)
                  throw new Error(
                    'License could not be imported. Check file and administrator access.'
                  )
                setLicenseMessage('License imported. Refresh workspace to load renewed access.')
              } catch (error) {
                setLicenseMessage(String(error))
              }
            }}
          />
          <p role="status">{licenseMessage}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-4">
        <Link href="/recovery" className="underline">
          Read patient records
        </Link>
        <a href="/api/settings/backup" className="underline">
          Download clinic backup (administrator)
        </a>
        <Link href="/settings" className="underline">
          Settings and license renewal
        </Link>
      </div>
      <p className="text-sm text-slate-600">
        Module changes preserve existing records. Staff roles still control access to individual
        records and exports.
      </p>
    </section>
  )
}
