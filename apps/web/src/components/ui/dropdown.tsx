import { useEffect, useRef, useState } from 'react'

export function Dropdown({
  trigger,
  children,
  label,
  triggerClassName = 'relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--foreground)] hover:bg-[var(--muted)]',
  panelClassName = 'w-72',
}: {
  trigger: (open: boolean) => React.ReactNode
  children: (close: () => void) => React.ReactNode
  label: string
  triggerClassName?: string
  panelClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger(open)}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-50 mt-2 max-h-[70vh] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 shadow-lg ${panelClassName}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
