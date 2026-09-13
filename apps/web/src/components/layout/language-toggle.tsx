import { useState } from 'react'
import { GlobeIcon } from '#/components/layout/icons'
import { Dropdown } from '#/components/ui/dropdown'
import { useSetMyLanguage } from '#/lib/queries/account'

const LANGUAGES = [
  { code: 'da' as const, label: 'Dansk' },
  { code: 'en' as const, label: 'English' },
]

// Only the selection itself is wired up for now — it persists to
// `profiles.language`, but translating the app's existing UI copy is a
// later, dedicated pass. See docs/backlog.html.
export function LanguageToggle({ profileId, initialLanguage }: { profileId: string; initialLanguage: 'da' | 'en' }) {
  const [language, setLanguage] = useState(initialLanguage)
  const setMyLanguage = useSetMyLanguage()

  function choose(code: 'da' | 'en', close: () => void) {
    close()
    if (code === language) return
    setLanguage(code)
    setMyLanguage.mutate({ profileId, language: code })
  }

  return (
    <Dropdown
      label="Change language"
      triggerClassName="flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-medium hover:bg-[var(--muted)]"
      panelClassName="w-36"
      trigger={() => (
        <>
          <GlobeIcon className="h-4 w-4 text-[var(--muted-foreground)]" />
          {language.toUpperCase()}
        </>
      )}
    >
      {(close) => (
        <>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => choose(l.code, close)}
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-[var(--muted)] ${
                l.code === language ? 'font-medium' : 'text-[var(--muted-foreground)]'
              }`}
            >
              {l.label}
              <span className="text-xs uppercase text-[var(--muted-foreground)]">{l.code}</span>
            </button>
          ))}
        </>
      )}
    </Dropdown>
  )
}
