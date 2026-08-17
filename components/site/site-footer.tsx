'use client'

import Link from 'next/link'

import { useLanguage } from '@/lib/i18n'
import { useLocalize, useSite } from '@/components/site/site-provider'

export function SiteFooter() {
  const { t } = useLanguage()
  const { config, tier } = useSite()
  const localize = useLocalize()

  return (
    <footer className="bg-[#101d30] px-5 py-12 text-white sm:px-10">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-xl font-semibold">{localize(config.clinic.name)}</p>
          <p className="mt-1 text-sm text-white/60">{localize(config.clinic.tagline)}</p>
          <p className="mt-3 text-sm text-white/60">
            {config.location.subCity}, {config.location.city}
          </p>
        </div>
        {tier === 'full' && (
          <Link href="/login" className="rounded-full bg-[#0877ea] px-6 py-3 text-sm font-semibold">
            {t('Open clinic workspace')}
          </Link>
        )}
      </div>
    </footer>
  )
}
