import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useCompletePasswordReset } from '#/lib/queries/account'
import { getSupabaseBrowserClient } from '#/lib/supabase/client'

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const completeReset = useCompletePasswordReset()

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    let settled = false
    const markReady = () => {
      if (!settled) {
        settled = true
        setReady(true)
      }
    }

    // The browser client auto-detects and exchanges the `?code=` (or hash)
    // from the recovery link on its own (detectSessionInUrl, on by default)
    // — calling exchangeCodeForSession ourselves here would race it and
    // fail, since a PKCE code is single-use. So we just wait for the
    // session it establishes, via whichever signal arrives first.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) markReady()
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReady()
    })

    const timeout = setTimeout(() => {
      if (!settled) setLinkError('This reset link is invalid or has expired.')
    }, 2500)

    return () => {
      clearTimeout(timeout)
      sub.subscription.unsubscribe()
    }
  }, [])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (newPassword.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match.')
      return
    }
    completeReset.mutate(newPassword, { onSuccess: () => navigate({ to: '/' }) })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="text-3xl font-semibold tracking-tight">Wopla AI</span>
        </div>
        <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <h1 className="text-sm font-semibold">Set a new password</h1>
          {linkError ? (
            <p className="text-sm text-[var(--destructive)]">{linkError}</p>
          ) : !ready ? (
            <p className="text-sm text-[var(--muted-foreground)]">Verifying your reset link…</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="newPassword" className="text-sm font-medium">
                  New password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                />
              </div>
              {formError && <p className="text-sm text-[var(--destructive)]">{formError}</p>}
              {completeReset.isError && (
                <p className="text-sm text-[var(--destructive)]">{(completeReset.error as Error).message}</p>
              )}
              <button
                type="submit"
                disabled={completeReset.isPending}
                className="w-full rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
              >
                {completeReset.isPending ? 'Saving…' : 'Set new password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
