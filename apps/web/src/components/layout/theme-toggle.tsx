import { useEffect, useState } from 'react'
import { MoonIcon, SunIcon } from '#/components/layout/icons'
import { resolvedTheme, setTheme, type Theme } from '#/lib/theme'

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    setThemeState(resolvedTheme())
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--muted)] px-0.5 transition-colors"
    >
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--card)] text-[var(--foreground)] shadow-sm transition-transform"
        style={{ transform: isDark ? 'translateX(20px)' : 'translateX(0)' }}
      >
        {isDark ? <MoonIcon className="h-3.5 w-3.5" /> : <SunIcon className="h-3.5 w-3.5" />}
      </span>
    </button>
  )
}
