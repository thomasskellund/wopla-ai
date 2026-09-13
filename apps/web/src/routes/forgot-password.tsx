import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { fetchSessionUser } from '#/lib/auth'
import { useRequestPasswordReset } from '#/lib/queries/account'

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: async () => {
    const user = await fetchSessionUser()
    if (user) throw redirect({ to: '/' })
  },
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const requestReset = useRequestPasswordReset()

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    requestReset.mutate(email, { onSuccess: () => setSent(true) })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="text-3xl font-semibold tracking-tight">Wopla AI</span>
        </div>
        <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div>
            <h1 className="text-sm font-semibold">Reset your password</h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Enter your email and we'll send you a link to set a new one.
            </p>
          </div>
          {sent ? (
            <p className="text-sm text-[var(--primary)]">
              If an account exists for that email, a reset link is on its way.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
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
              {requestReset.isError && (
                <p className="text-sm text-[var(--destructive)]">{(requestReset.error as Error).message}</p>
              )}
              <button
                type="submit"
                disabled={requestReset.isPending}
                className="w-full rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
              >
                {requestReset.isPending ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}
          <Link to="/login" className="block text-center text-sm text-[var(--muted-foreground)] hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </main>
  )
}
