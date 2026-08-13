'use client'

import dynamic from 'next/dynamic'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlobalSearch } from './global-search'
import { ThemeToggle } from './theme-toggle'
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
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-slate-100 bg-white px-4 md:px-6">
      {/* Mobile menu button */}
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      <div className="hidden min-w-0 md:block">
        <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
        <p className="truncate text-xs capitalize text-slate-400">{user.role.toLowerCase()}</p>
      </div>

      {/* Global Search */}
      <GlobalSearch />

      <LanguageSwitcher compact />

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <NotificationTray />

        {/* User menu */}
        <UserMenu user={user} />
      </div>
    </header>
  )
}
