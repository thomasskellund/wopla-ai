import { useEffect, useState } from 'react'
import { useCompanyWorkingDays, useSetCompanyWorkingDays } from '#/lib/queries/virksomheder'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const LABELS: Record<(typeof DAYS)[number], string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

export function WorkingDaysForm({ companyId }: { companyId: string }) {
  const { data } = useCompanyWorkingDays(companyId)
  const setWorkingDays = useSetCompanyWorkingDays(companyId)
  const [days, setDays] = useState<Record<(typeof DAYS)[number], boolean>>({
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: false,
    sun: false,
  })

  useEffect(() => {
    if (data) setDays({ mon: data.mon, tue: data.tue, wed: data.wed, thu: data.thu, fri: data.fri, sat: data.sat, sun: data.sun })
  }, [data])

  return (
    <div className="max-w-md space-y-3">
      <p className="text-xs text-neutral-500">No row saved yet defaults to Mon–Fri.</p>
      <div className="flex gap-3">
        {DAYS.map((d) => (
          <label key={d} className="flex flex-col items-center gap-1 text-xs text-neutral-500">
            {LABELS[d]}
            <input type="checkbox" checked={days[d]} onChange={(e) => setDays((s) => ({ ...s, [d]: e.target.checked }))} />
          </label>
        ))}
      </div>
      <button
        onClick={() => setWorkingDays.mutate(days)}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
      >
        Save working days
      </button>
    </div>
  )
}
