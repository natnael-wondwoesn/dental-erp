'use client'

import { Languages } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLanguage()
  const next = locale === 'en' ? 'am' : 'en'

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-[#0877ea] hover:text-[#0877ea]"
      aria-label={locale === 'en' ? 'Switch to Amharic' : 'Switch to English'}
    >
      <Languages className="h-4 w-4" />
      {!compact && (locale === 'en' ? 'አማ' : 'EN')}
    </button>
  )
}
