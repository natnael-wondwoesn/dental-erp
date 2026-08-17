'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, Stethoscope, X } from 'lucide-react'

import { LanguageSwitcher } from '@/components/language-switcher'
import { useLanguage } from '@/lib/i18n'
import { useLocalize, useSite } from '@/components/site/site-provider'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About us' },
  { href: '/#services', label: 'Services' },
  { href: '/contact', label: 'Contact' },
]

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { t } = useLanguage()
  const { config, tier } = useSite()
  const localize = useLocalize()
  const pathname = usePathname()

  return (
    <>
      <header className="absolute left-1/2 top-5 z-20 flex w-[calc(100%-2rem)] max-w-[1260px] -translate-x-1/2 items-center justify-between rounded-full bg-white px-5 py-3 shadow-xl sm:top-8 sm:px-7">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0877ea] text-white">
            <Stethoscope className="h-4 w-4" />
          </span>
          <span className="text-lg">{localize(config.clinic.name)}</span>
        </Link>

        <nav className="hidden items-center gap-9 text-sm text-slate-600 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? 'font-semibold text-slate-950'
                  : 'transition hover:text-[#0877ea]'
              }
            >
              {t(link.label)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          {tier === 'full' && (
            <Link
              href="/login"
              className="hidden rounded-full bg-[#0877ea] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0663c5] md:block"
            >
              {t('Open workspace')}
            </Link>
          )}
          <button
            className="md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="absolute left-6 right-6 top-24 z-20 rounded-3xl bg-white p-5 shadow-2xl md:hidden">
          <nav className="flex flex-col gap-4 text-sm font-medium">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
                {t(link.label)}
              </Link>
            ))}
            {tier === 'full' && (
              <Link
                href="/login"
                className="rounded-full bg-[#0877ea] px-5 py-3 text-center text-white"
              >
                {t('Open workspace')}
              </Link>
            )}
          </nav>
        </div>
      )}
    </>
  )
}
