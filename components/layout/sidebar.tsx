'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeft, Stethoscope } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getNavigationForRole } from '@/config/nav'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useSidebar } from './sidebar-context'
import { useLanguage } from '@/lib/i18n'

interface SidebarProps {
  role: string
  hospitalName?: string
  hospitalLogo?: string | null
  plan?: string
}

export function Sidebar({ role, hospitalName, hospitalLogo, plan }: SidebarProps) {
  const pathname = usePathname()
  const navigation = getNavigationForRole(role)
  const { isCollapsed, toggleSidebar } = useSidebar()
  const { t } = useLanguage()

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'flex h-full flex-col border-r border-[#e7edf5] bg-white transition-all duration-300 ease-in-out',
          isCollapsed ? 'w-[72px]' : 'w-[268px]'
        )}
      >
        {/* Header with Logo and Toggle */}
        <div
          className={cn(
            'flex h-[72px] items-center border-b border-[#edf1f6]',
            isCollapsed ? 'justify-center px-2' : 'justify-between px-5'
          )}
        >
          {/* Logo */}
          <Link
            href="/dashboard"
            className={cn(
              'flex items-center gap-3 transition-all duration-300',
              isCollapsed && 'justify-center'
            )}
          >
            {hospitalLogo ? (
              <img
                src={hospitalLogo}
                alt={hospitalName || 'Logo'}
                className="h-8 w-8 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0769e7] text-white shadow-[0_8px_20px_rgba(7,105,231,.22)]">
                <Stethoscope className="h-5 w-5" />
              </div>
            )}
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="max-w-[150px] truncate text-[15px] font-semibold leading-tight tracking-[-.02em] text-[#13233a]">
                  {hospitalName || 'Sunny Smile Speciality Clinic'}
                </span>
                {plan && (
                  <span
                    className={cn(
                      'mt-1 text-[10px] font-medium leading-tight',
                      plan === 'FREE' ? 'text-muted-foreground' : 'text-primary'
                    )}
                  >
                    {plan === 'FREE'
                      ? 'Free Plan'
                      : plan === 'PROFESSIONAL'
                        ? 'Professional'
                        : plan === 'ENTERPRISE'
                          ? 'Enterprise'
                          : 'Self-Hosted'}
                  </span>
                )}
              </div>
            )}
          </Link>

          {/* Toggle Button - only show when expanded */}
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={toggleSidebar}
            >
              <PanelLeftClose className="h-4 w-4" />
              <span className="sr-only">Collapse sidebar</span>
            </Button>
          )}
        </div>

        {/* Toggle Button when collapsed - separate row */}
        {isCollapsed && (
          <div className="flex justify-center py-2 border-b">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10" onClick={toggleSidebar}>
                  <PanelLeft className="h-5 w-5" />
                  <span className="sr-only">Expand sidebar</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Navigation */}
        <ScrollArea className="flex-1">
          <nav
            className={cn('flex flex-col gap-1 py-4', isCollapsed ? 'px-2' : 'px-3')}
            aria-label="Clinic navigation"
          >
            {navigation.map((section, sectionIndex) => (
              <div key={section.title} className={sectionIndex > 0 ? 'mt-4' : ''}>
                {/* Section Title - hidden when collapsed */}
                {!isCollapsed && (
                  <h4 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">
                    {t(section.title)}
                  </h4>
                )}
                <div className="flex flex-col gap-1">
                  {section.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/dashboard' && pathname.startsWith(item.href))
                    const Icon = item.icon

                    if (isCollapsed) {
                      return (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild>
                            <Link
                              href={item.href}
                              className={cn(
                                'flex h-11 w-full items-center justify-center rounded-xl transition-colors',
                                isActive
                                  ? 'bg-[#eaf3ff] text-[#0769e7]'
                                  : 'text-slate-400 hover:bg-[#f4f8fd] hover:text-[#13233a]'
                              )}
                            >
                              <Icon className="h-5 w-5" />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="flex items-center gap-2">
                            {item.title}
                            {item.badge && (
                              <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                                {item.badge}
                              </span>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      )
                    }

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-colors',
                          isActive
                            ? 'bg-[#0769e7] text-white font-semibold shadow-[0_7px_18px_rgba(7,105,231,.18)]'
                            : 'text-slate-500 hover:bg-[#f4f8fd] hover:text-[#13233a]'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{t(item.title)}</span>
                        {item.badge && (
                          <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div
          className={cn(
            'border-t border-[#edf1f6] py-4 text-center',
            isCollapsed ? 'px-2' : 'px-4'
          )}
        >
          <p className="text-[10px] font-medium text-slate-400">
            {isCollapsed ? 'v1.0' : 'Dental ERP v1.0'}
          </p>
        </div>
      </div>
    </TooltipProvider>
  )
}
