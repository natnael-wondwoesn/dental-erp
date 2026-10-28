'use client'

import { createContext, useContext, useEffect, useState, type CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { modulesForPath, type SaaSAccess } from '@/lib/saas/catalog'
import { useLanguage } from '@/lib/i18n'

const AccessContext = createContext<SaaSAccess | undefined>(undefined)
export const useTenantAccess = () => useContext(AccessContext)

export function TenantAccessProvider({
  initial,
  children,
}: {
  initial?: SaaSAccess
  children: React.ReactNode
}) {
  const [access, setAccess] = useState(initial)
  useEffect(() => {
    if (!initial) return
    let mounted = true
    const refresh = async () => {
      try {
        const response = await fetch('/api/access', { cache: 'no-store' })
        if (!response.ok) throw new Error('Policy unavailable')
        const value: SaaSAccess = await response.json()
        if (mounted) setAccess(value)
      } catch {
        if (mounted)
          setAccess(
            (previous) => previous && { ...previous, state: 'recovery', allowsWrite: false }
          )
      }
    }
    const timer = setInterval(refresh, 30000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [initial])
  return (
    <AccessContext.Provider value={access}>
      <div
        className="contents"
        style={{ '--clinic-color': access?.branding.primaryColor || '#0769e7' } as CSSProperties}
      >
        {children}
      </div>
    </AccessContext.Provider>
  )
}

export function TenantWorkspace({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage()
  const access = useTenantAccess()
  const pathname = usePathname()
  if (!access) return children
  const required = modulesForPath(pathname)
  const enabled =
    pathname.startsWith('/owner') || required?.every((key) => access.modules.includes(key))
  const recovery =
    pathname === '/settings/subscription' || pathname === '/settings' || pathname === '/recovery'
  return (
    <>
      {(!access.allowsWrite || access.state === 'grace') && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <strong>
            {t(access.state === 'grace' ? 'Subscription grace period' : 'Workspace is read-only')}
          </strong>
          <p>
            {access.branding.renewalContact ||
              t('Contact your software provider to renew or restore access.')}
          </p>
          <p>
            {t('Records and recovery remain available.')}{' '}
            <Link className="underline" href="/settings/subscription">
              {t('Subscription details')}
            </Link>
          </p>
        </div>
      )}
      {enabled || recovery ? (
        children
      ) : (
        <section className="rounded-2xl border bg-white p-8">
          <h1 className="text-xl font-semibold">{t('Module not included')}</h1>
          <p className="mt-2 text-slate-600">
            {t('Contact your software provider to add this module to your clinic.')}
          </p>
          <Link className="mt-4 inline-block underline" href="/dashboard">
            {t('Return to workspace')}
          </Link>
        </section>
      )}
    </>
  )
}

export function ModularDashboard() {
  const { t } = useLanguage()
  const access = useTenantAccess()
  const links = [
    ['patients', '/patients', 'Patients'],
    ['appointments', '/appointments', 'Appointments'],
    ['clinical', '/treatments', 'Clinical care'],
    ['billing', '/billing', 'Billing'],
    ['lab', '/lab', 'Laboratory'],
    ['finance', '/finance', 'Finance'],
    ['inventory', '/inventory', 'Inventory'],
    ['staff', '/staff', 'Staff'],
    ['reports', '/reports', 'Reports'],
    ['crm', '/crm', 'CRM'],
    ['communications', '/communications', 'Communications'],
    ['forms', '/forms', 'Forms'],
    ['sterilization', '/sterilization', 'Sterilization'],
    ['devices', '/devices', 'Devices'],
    ['video', '/video', 'Video consultations'],
    ['ai', '/chat', 'AI tools'],
  ] as const
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">
          {t(access?.planName || '')} · {t(access?.state || '')}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          {access?.branding.displayName || access?.name}
        </h1>
        <p className="mt-2 text-slate-600">{t('Your clinic workspace')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {links
          .filter(([id]) => access?.modules.includes(id))
          .map(([id, href, label]) => (
            <Link
              key={id}
              href={href}
              className="rounded-2xl border bg-white p-6 font-semibold shadow-sm hover:border-blue-400"
            >
              {t(label)} <span aria-hidden>→</span>
            </Link>
          ))}
      </div>
      <Link href="/settings/subscription" className="inline-block text-sm underline">
        {t('Subscription, backup and recovery')}
      </Link>
    </section>
  )
}
