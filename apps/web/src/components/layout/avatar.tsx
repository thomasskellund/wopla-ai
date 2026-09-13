// Deterministic initials avatar — no photo-upload feature exists yet, and a
// generic gray placeholder would read as unfinished, so the color and
// initials are derived from the name instead.
const PALETTE = [
  'oklch(0.7 0.13 25)',
  'oklch(0.72 0.13 70)',
  'oklch(0.7 0.13 145)',
  'oklch(0.68 0.13 200)',
  'oklch(0.68 0.13 260)',
  'oklch(0.68 0.14 320)',
]

function colorForName(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-medium text-white"
      style={{ width: size, height: size, fontSize: size * 0.4, background: colorForName(name) }}
    >
      {initialsFor(name)}
    </div>
  )
}
