export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'wopla-theme'

export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

export function applyTheme(theme: Theme | null) {
  if (theme) {
    document.documentElement.setAttribute('data-theme', theme)
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

export function setTheme(theme: Theme | null) {
  applyTheme(theme)
  try {
    if (theme) localStorage.setItem(STORAGE_KEY, theme)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore (private browsing, storage disabled, ...)
  }
}

/** Effective theme right now: the explicit choice, or the OS preference. */
export function resolvedTheme(): Theme {
  const stored = getStoredTheme()
  if (stored) return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Inlined into <head> so the right theme applies before first paint (no flash). */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var v = localStorage.getItem('${STORAGE_KEY}');
    if (v === 'light' || v === 'dark') document.documentElement.setAttribute('data-theme', v);
  } catch (e) {}
})();
`
