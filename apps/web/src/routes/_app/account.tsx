import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useChangePassword } from '#/lib/queries/account'

export const Route = createFileRoute('/_app/account')({
  component: AccountPage,
})

function AccountPage() {
  const { user } = Route.useRouteContext()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const changePassword = useChangePassword()

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSuccess(false)
    if (newPassword.length < 8) {
      setFormError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setFormError('New password and confirmation do not match.')
      return
    }
    changePassword.mutate(
      { email: user.email, currentPassword, newPassword },
      {
        onSuccess: () => {
          setSuccess(true)
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
        },
      },
    )
  }

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Account</h1>
        <p className="text-sm text-[var(--muted-foreground)]">{user.email}</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm"
      >
        <h2 className="text-sm font-semibold">Change password</h2>
        <div className="space-y-1.5">
          <label htmlFor="currentPassword" className="text-sm font-medium">
            Current password
          </label>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          />
        </div>
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
        {changePassword.isError && (
          <p className="text-sm text-[var(--destructive)]">{(changePassword.error as Error).message}</p>
        )}
        {success && <p className="text-sm text-[var(--primary)]">Password updated.</p>}
        <button
          type="submit"
          disabled={changePassword.isPending}
          className="w-full rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
        >
          {changePassword.isPending ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
