'use client'

import dynamic from 'next/dynamic'
import { CalendarPlus, MapPin, Menu } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { GlobalSearch } from './global-search'
import { useSidebar } from './sidebar-context'
import { LanguageSwitcher } from '@/components/language-switcher'

const UserMenu = dynamic(() => import('./user-menu').then((m) => m.UserMenu), {
  ssr: false,
  loading: () => <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />,
})

const NotificationTray = dynamic(
  () => import('./notification-tray').then((m) => m.NotificationTray),
  {
    ssr: false,
    loading: () => <div className="h-10 w-10 rounded bg-muted animate-pulse" />,
  }
)

interface HeaderProps {
  user: {
    name: string
    email: string
    role: string
  }
}

export function Header({ user }: HeaderProps) {
  const { setMobileOpen } = useSidebar()

  return (
    <header className="sticky top-0 z-40 flex h-[72px] items-center gap-3 border-b border-[#e7edf5] bg-white/95 px-4 backdrop-blur md:px-6 lg:px-7">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="text-slate-600 md:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      <div className="hidden min-w-0 lg:block">
        <p className="truncate text-[13px] font-semibold text-[#13233a]">{user.name}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-400">
          <MapPin className="h-3 w-3" /> Addis Ababa
        </p>
      </div>

      {/* Global Search */}
      <GlobalSearch />

      <Link
        href="/appointments/new"
        className="hidden h-10 items-center gap-2 rounded-full bg-[#0769e7] px-4 text-sm font-semibold text-white shadow-[0_7px_18px_rgba(7,105,231,.18)] transition hover:bg-[#075dcc] xl:inline-flex"
      >
        <CalendarPlus className="h-4 w-4" /> New appointment
      </Link>

      <LanguageSwitcher compact />

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <NotificationTray />

        {/* User menu */}
        <UserMenu user={user} />
      </div>
    </header>
  )
}
