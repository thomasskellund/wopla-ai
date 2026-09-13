import { useState } from 'react'
import {
  useCompanyEmployees,
  useCompanyHolidays,
  useCreateCompanyHoliday,
  useCreateEmployeeAbsence,
  useCreatePublicHoliday,
  useDeleteCompanyHoliday,
  useDeleteEmployeeAbsence,
  useDeletePublicHoliday,
  useEmployeeAbsences,
  usePublicHolidays,
} from '#/lib/queries/virksomheder'

function CompanyClosures({ companyId }: { companyId: string }) {
  const { data: holidays } = useCompanyHolidays(companyId)
  const createHoliday = useCreateCompanyHoliday(companyId)
  const deleteHoliday = useDeleteCompanyHoliday(companyId)
  const [date, setDate] = useState('')

  return (
    <div className="max-w-md">
      <h3 className="mb-2 text-sm font-medium">Company closures</h3>
      <div className="mb-2 flex gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-[var(--border)] px-2 py-1.5 text-sm" />
        <button
          disabled={!date}
          onClick={() => createHoliday.mutate(date, { onSuccess: () => setDate('') })}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Add closure
        </button>
      </div>
      <ul className="space-y-1 text-sm">
        {holidays?.map((h) => (
          <li key={h.id} className="flex items-center justify-between rounded border border-[var(--border)] px-2 py-1">
            {h.holiday_date}
            <button onClick={() => deleteHoliday.mutate(h.id)} className="text-xs text-neutral-500 hover:underline">
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EmployeeAbsencesSection({ companyId }: { companyId: string }) {
  const { data: employees } = useCompanyEmployees(companyId)
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const { data: absences } = useEmployeeAbsences(selectedProfileId || null)
  const createAbsence = useCreateEmployeeAbsence(selectedProfileId)
  const deleteAbsence = useDeleteEmployeeAbsence(selectedProfileId)
  const [date, setDate] = useState('')

  return (
    <div className="max-w-md">
      <h3 className="mb-2 text-sm font-medium">Employee absences</h3>
      <select
        value={selectedProfileId}
        onChange={(e) => setSelectedProfileId(e.target.value)}
        className="mb-2 w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
      >
        <option value="">Choose an employee…</option>
        {employees?.map((e) => (
          <option key={e.id} value={e.id}>
            {e.full_name}
          </option>
        ))}
      </select>
      {selectedProfileId && (
        <>
          <div className="mb-2 flex gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-[var(--border)] px-2 py-1.5 text-sm" />
            <button
              disabled={!date}
              onClick={() => createAbsence.mutate(date, { onSuccess: () => setDate('') })}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              Add absence
            </button>
          </div>
          <ul className="space-y-1 text-sm">
            {absences?.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded border border-[var(--border)] px-2 py-1">
                {a.absence_date}
                <button onClick={() => deleteAbsence.mutate(a.id)} className="text-xs text-neutral-500 hover:underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function PublicHolidaysSection() {
  const { data: holidays } = usePublicHolidays()
  const createHoliday = useCreatePublicHoliday()
  const deleteHoliday = useDeletePublicHoliday()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')

  return (
    <div className="max-w-md">
      <h3 className="mb-2 text-sm font-medium">Public holidays (all companies)</h3>
      <div className="mb-2 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-32 rounded-md border border-[var(--border)] px-2 py-1.5 text-sm" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-[var(--border)] px-2 py-1.5 text-sm" />
        <button
          disabled={!name || !date}
          onClick={() => createHoliday.mutate({ name, holidayDate: date }, { onSuccess: () => { setName(''); setDate('') } })}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>
      <ul className="space-y-1 text-sm">
        {holidays?.map((h) => (
          <li key={h.id} className="flex items-center justify-between rounded border border-[var(--border)] px-2 py-1">
            {h.holiday_date} — {h.name}
            <button onClick={() => deleteHoliday.mutate(h.id)} className="text-xs text-neutral-500 hover:underline">
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function HolidaysPanel({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <CompanyClosures companyId={companyId} />
      <EmployeeAbsencesSection companyId={companyId} />
      {isAdmin && <PublicHolidaysSection />}
    </div>
  )
}
