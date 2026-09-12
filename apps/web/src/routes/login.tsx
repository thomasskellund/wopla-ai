import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { QuickLoginButtons } from '#/components/demo-access/quick-login-buttons' // DEMO-ONLY, see components/demo-access/README.md
import { fetchSessionUser, loginFn } from '#/lib/auth'
import { queryClient } from '#/lib/query-client'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const user = await fetchSessionUser()
    if (user) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const result = await loginFn({ data: { email, password } })
    setPending(false)
    if (result.error) {
      setError('Login failed')
      return
    }
    queryClient.clear()
    await router.invalidate()
    await router.navigate({ to: '/' })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="text-3xl font-semibold tracking-tight">Wopla AI</span>
        </div>
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm"
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
          >
            {pending ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        {/* DEMO-ONLY, see components/demo-access/README.md */}
        <QuickLoginButtons />
      </div>
    </main>
  )
}
