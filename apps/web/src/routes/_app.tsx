import { Link, Outlet, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { fetchSessionUser, logoutFn } from '#/lib/auth'
import { useChatUnreadTotal } from '#/lib/queries/chat'
import { queryClient } from '#/lib/query-client'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const user = await fetchSessionUser()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  component: AppLayout,
})

const CHAT_ROLES = new Set(['admin', 'company_admin', 'vendor_admin'])

function AppLayout() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const canChat = CHAT_ROLES.has(user.role)
  const { data: unreadTotal } = useChatUnreadTotal(canChat)

  async function onLogout() {
    await logoutFn()
    queryClient.clear()
    await router.invalidate()
    await router.navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold">Wopla AI</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-neutral-600 hover:underline [&.active]:font-medium [&.active]:text-neutral-900">
              Home
            </Link>
            {canChat && (
              <Link
                to="/chat"
                className="relative text-neutral-600 hover:underline [&.active]:font-medium [&.active]:text-neutral-900"
              >
                Chat
                {!!unreadTotal && (
                  <span className="ml-1.5 rounded-full bg-[var(--destructive)] px-1.5 py-0.5 text-xs font-medium text-white">
                    {unreadTotal}
                  </span>
                )}
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span>
            {user.fullName} · <span className="text-neutral-500">{user.role}</span>
          </span>
          <button onClick={onLogout} className="text-neutral-500 hover:underline">
            Log out
          </button>
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
