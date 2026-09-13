import { Link, Outlet, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { AnnouncementsMenu } from '#/components/layout/announcements-menu'
import { MenuIcon, XIcon } from '#/components/layout/icons'
import { LanguageToggle } from '#/components/layout/language-toggle'
import { NotificationBell } from '#/components/layout/notification-bell'
import { ThemeToggle } from '#/components/layout/theme-toggle'
import { UserMenu } from '#/components/layout/user-menu'
import { fetchSessionUser, logoutFn } from '#/lib/auth'
import { queryClient } from '#/lib/query-client'
import { useChatUnreadRealtime } from '#/lib/queries/chat'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const user = await fetchSessionUser()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  component: AppLayout,
})

const CHAT_ROLES = new Set(['admin', 'company_admin', 'vendor_admin'])
const ORDERING_ROLES = new Set(['company_admin', 'employee', 'vendor_admin'])
const INVOICING_ROLES = new Set(['admin', 'company_admin', 'vendor_admin'])
const COMPANIES_ROLES = new Set(['admin', 'company_admin'])
const VENDORS_ROLES = new Set(['admin', 'vendor_admin'])

function AppLayout() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const [navOpen, setNavOpen] = useState(false)
  const canChat = CHAT_ROLES.has(user.role)
  useChatUnreadRealtime(canChat ? user.id : null)

  async function onLogout() {
    await logoutFn()
    queryClient.clear()
    await router.invalidate()
    await router.navigate({ to: '/login' })
  }

  const navLinks = [
    { to: '/', label: 'Home', show: true },
    { to: '/companies', label: 'Companies', show: COMPANIES_ROLES.has(user.role) },
    { to: '/vendors', label: 'Vendors', show: VENDORS_ROLES.has(user.role) },
    { to: '/ordering', label: 'Ordering', show: ORDERING_ROLES.has(user.role) },
    { to: '/invoicing', label: 'Invoicing', show: INVOICING_ROLES.has(user.role) },
    { to: '/chat', label: 'Chat', show: canChat },
  ].filter((l) => l.show)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)]">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setNavOpen((o) => !o)}
              aria-label={navOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={navOpen}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-[var(--muted)] sm:hidden"
            >
              {navOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
            <span className="whitespace-nowrap font-semibold">Wopla AI</span>
            <nav className="hidden items-center gap-4 text-sm sm:flex">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] [&.active]:font-medium [&.active]:text-[var(--foreground)]"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <NotificationBell enabled={canChat} />
            <AnnouncementsMenu isAdmin={user.role === 'admin'} />
            <ThemeToggle />
            <LanguageToggle profileId={user.id} initialLanguage={user.language} />
            <UserMenu fullName={user.fullName} role={user.role} tenantName={user.tenantName} onLogout={onLogout} />
          </div>
        </div>
        {navOpen && (
          <nav className="flex flex-col border-t border-[var(--border)] px-4 py-2 text-sm sm:hidden">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setNavOpen(false)}
                className="rounded-md px-2 py-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] [&.active]:font-medium [&.active]:text-[var(--foreground)]"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className="p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  )
}
