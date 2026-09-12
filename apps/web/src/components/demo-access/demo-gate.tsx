// See README.md in this folder — remove before production.
import { useEffect, useState } from 'react'
import { GATE_PASSWORD, GATE_STORAGE_KEY, GATE_USERNAME } from './config'

/**
 * Full-site password gate in front of the demo deployment. Not a security
 * boundary (the password ships in the client bundle) — just keeps casual
 * visitors from stumbling onto a work-in-progress site.
 */
export function DemoGate({ children }: { children: React.ReactNode }) {
  // Server-rendered as locked (no localStorage there); an effect unlocks it
  // client-side on mount if the visitor already passed the gate before.
  const [unlocked, setUnlocked] = useState(false)
  const [checked, setChecked] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    setUnlocked(localStorage.getItem(GATE_STORAGE_KEY) === 'true')
    setChecked(true)
  }, [])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (username === GATE_USERNAME && password === GATE_PASSWORD) {
      localStorage.setItem(GATE_STORAGE_KEY, 'true')
      setUnlocked(true)
      setError(false)
    } else {
      setError(true)
    }
  }

  // Avoids a flash of the gate on an already-unlocked return visit.
  if (!checked) return null
  if (unlocked) return children

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
          <h1 className="text-lg font-semibold">Demo access</h1>
          <div className="space-y-1.5">
            <label htmlFor="gate-username" className="text-sm font-medium">
              Username
            </label>
            <input
              id="gate-username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="gate-password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="gate-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-[var(--destructive)]">Wrong username or password.</p>}
          <button
            type="submit"
            className="w-full rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          >
            Enter
          </button>
        </form>
      </div>
    </main>
  )
}
