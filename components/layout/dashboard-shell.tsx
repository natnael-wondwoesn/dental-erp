'use client'

import { Sidebar } from './sidebar'
import { MobileSidebar } from './mobile-sidebar'
import { Header } from './header'
import { SidebarProvider } from './sidebar-context'
import { AIProvider } from '@/components/ai/ai-provider'
import { CommandBar } from '@/components/ai/command-bar'
import { ChatWidget } from '@/components/ai/chat-widget'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { KeyboardShortcutHelp } from '@/components/layout/keyboard-shortcut-help'

interface DashboardShellProps {
  children: React.ReactNode
  user: {
    name: string
    email: string
    role: string
    isPlatformOwner?: boolean
  }
  hospital?: {
    name: string
    plan: string
    logo?: string | null
  }
  isPlatformControlPlane?: boolean
}

export function DashboardShell({
  children,
  user,
  hospital,
  isPlatformControlPlane = false,
}: DashboardShellProps) {
  return (
    <AIProvider>
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden bg-[#eef4fb]">
          {/* Sidebar - the drawer preserves working width on phones and portrait tablets */}
          <aside className="hidden lg:flex">
            <Sidebar
              role={user.role}
              hospitalName={hospital?.name}
              hospitalLogo={hospital?.logo}
              plan={hospital?.plan}
              isPlatformOwner={user.isPlatformOwner}
              isPlatformControlPlane={isPlatformControlPlane}
            />
          </aside>

          {/* Mobile sidebar overlay */}
          <MobileSidebar
            role={user.role}
            hospitalName={hospital?.name}
            hospitalLogo={hospital?.logo}
            plan={hospital?.plan}
            isPlatformOwner={user.isPlatformOwner}
            isPlatformControlPlane={isPlatformControlPlane}
          />

          {/* Main content */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Header user={user} isPlatformControlPlane={isPlatformControlPlane} />
            <main className="min-w-0 flex-1 overflow-auto bg-[#eef4fb] p-3 sm:p-4 lg:p-7">
              <Breadcrumb className="mb-5" />
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
      {!isPlatformControlPlane && (
        <>
          <CommandBar />
          <ChatWidget />
          <KeyboardShortcutHelp />
        </>
      )}
    </AIProvider>
  )
}
