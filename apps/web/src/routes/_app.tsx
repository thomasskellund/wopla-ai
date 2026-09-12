import { Outlet, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { fetchSessionUser, logoutFn } from '#/lib/auth'
import { queryClient } from '#/lib/query-client'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const user = await fetchSessionUser()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  component: AppLayout,
})

function AppLayout() {
  const { user } = Route.useRouteContext()
  const router = useRouter()

  async function onLogout() {
    await logoutFn()
    queryClient.clear()
    await router.invalidate()
    await router.navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3">
        <span className="font-semibold">Wopla AI</span>
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
