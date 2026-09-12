// See README.md in this folder — remove before production.
import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { loginFn } from '#/lib/auth'
import { queryClient } from '#/lib/query-client'
import { QUICK_LOGIN_USERS } from './config'

/** One-click login as a seeded demo user, for testers poking at a demo deployment. */
export function QuickLoginButtons() {
  const router = useRouter()
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  async function quickLogin(email: string, password: string) {
    setPendingEmail(email)
    const result = await loginFn({ data: { email, password } })
    if (!result.error) {
      queryClient.clear()
      await router.invalidate()
      await router.navigate({ to: '/' })
      return
    }
    setPendingEmail(null)
  }

  return (
    <div className="space-y-2 border-t border-[var(--border)] pt-4">
      <p className="text-center text-xs text-neutral-500">Quick login (demo)</p>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_LOGIN_USERS.map((u) => (
          <button
            key={u.email}
            type="button"
            disabled={pendingEmail !== null}
            onClick={() => quickLogin(u.email, u.password)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-60"
          >
            {pendingEmail === u.email ? '…' : u.label}
          </button>
        ))}
      </div>
    </div>
  )
}
