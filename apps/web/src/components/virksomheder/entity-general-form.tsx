import { useState } from 'react'

type Props = {
  initial?: { name: string; address?: string | null; city?: string | null; zip?: string | null; vat_number?: string | null }
  onSave: (args: { name: string; address?: string; city?: string; zip?: string; vatNumber?: string }) => void
  isSaving: boolean
  submitLabel: string
}

export function EntityGeneralForm({ initial, onSave, isSaving, submitLabel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [city, setCity] = useState(initial?.city ?? '')
  const [zip, setZip] = useState(initial?.zip ?? '')
  const [vatNumber, setVatNumber] = useState(initial?.vat_number ?? '')

  return (
    <div className="max-w-md space-y-2">
      <label className="block text-xs text-neutral-500">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm text-neutral-900"
        />
      </label>
      <label className="block text-xs text-neutral-500">
        Address
        <input
          value={address ?? ''}
          onChange={(e) => setAddress(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm text-neutral-900"
        />
      </label>
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-neutral-500">
          City
          <input
            value={city ?? ''}
            onChange={(e) => setCity(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm text-neutral-900"
          />
        </label>
        <label className="w-28 text-xs text-neutral-500">
          Zip
          <input
            value={zip ?? ''}
            onChange={(e) => setZip(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm text-neutral-900"
          />
        </label>
      </div>
      <label className="block text-xs text-neutral-500">
        VAT number
        <input
          value={vatNumber ?? ''}
          onChange={(e) => setVatNumber(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm text-neutral-900"
        />
      </label>
      <button
        disabled={!name || isSaving}
        onClick={() => onSave({ name, address, city, zip, vatNumber })}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </div>
  )
}
