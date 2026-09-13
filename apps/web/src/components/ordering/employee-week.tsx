import { useMemo, useState } from 'react'
import { localISODate } from '#/lib/dates'
import { useDishes, useMyWeek, useMyWeeklyPreferences, useSetMyDailyChoice, useSetMyWeeklyPreference } from '#/lib/queries/ordering'

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const WEEKDAY_LABELS: Record<(typeof WEEKDAYS)[number], string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

function mondayOf(date: Date) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

type Props = { orderId: string; vendorId: string }

export function EmployeeWeek({ orderId, vendorId }: Props) {
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = useMemo(() => {
    const d = mondayOf(new Date())
    d.setDate(d.getDate() + weekOffset * 7)
    return d
  }, [weekOffset])
  const weekStartISO = localISODate(weekStart)

  const { data: dishes } = useDishes(vendorId)
  const { data: week, isLoading } = useMyWeek(orderId, weekStartISO)
  const { data: weeklyPrefs } = useMyWeeklyPreferences(orderId)
  const setDailyChoice = useSetMyDailyChoice(orderId)
  const setWeeklyPref = useSetMyWeeklyPreference(orderId)

  function standingChoiceFor(weekday: string) {
    return weeklyPrefs?.find((p) => p.weekday === weekday)?.dish_id ?? ''
  }

  return (
    <div className="max-w-2xl space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-700">Your standard weekly choice</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Set this once — every matching weekday follows it automatically until you change it or correct an
          individual day below.
        </p>
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.slice(0, 5).map((wd) => (
            <label key={wd} className="flex flex-col gap-1 text-xs text-neutral-500">
              {WEEKDAY_LABELS[wd]}
              <select
                className="rounded-md border border-[var(--border)] px-2 py-1 text-sm text-neutral-900"
                onChange={(e) => setWeeklyPref.mutate({ weekday: wd, dishId: e.target.value || null })}
                value={standingChoiceFor(wd)}
              >
                <option value="">No lunch</option>
                {dishes?.map((dish) => (
                  <option key={dish.id} value={dish.id}>
                    {dish.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-700">Week of {weekStartISO}</h2>
          <div className="flex gap-2 text-xs">
            <button onClick={() => setWeekOffset((o) => o - 1)} className="rounded border border-[var(--border)] px-2 py-1 hover:bg-neutral-50">
              ← Previous
            </button>
            <button onClick={() => setWeekOffset(0)} className="rounded border border-[var(--border)] px-2 py-1 hover:bg-neutral-50">
              This week
            </button>
            <button onClick={() => setWeekOffset((o) => o + 1)} className="rounded border border-[var(--border)] px-2 py-1 hover:bg-neutral-50">
              Next →
            </button>
          </div>
        </div>
        {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
        <div className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
          {week?.map((day) => (
            <div key={day.order_date} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="w-40 text-sm">
                <div className="font-medium">{WEEKDAY_LABELS[day.weekday as (typeof WEEKDAYS)[number]]}</div>
                <div className="text-xs text-neutral-500">{day.order_date}</div>
              </div>
              {day.status === 'cancelled' ? (
                <span className="text-sm text-neutral-500">Cancelled for everyone</span>
              ) : day.can_edit ? (
                <select
                  className="rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                  value={day.dish_id ?? ''}
                  onChange={(e) =>
                    setDailyChoice.mutate({ orderDate: day.order_date, dishId: e.target.value || null })
                  }
                >
                  <option value="">No lunch</option>
                  {dishes?.map((dish) => (
                    <option key={dish.id} value={dish.id}>
                      {dish.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <span>{day.dish_name ?? 'No lunch'}</span>
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">
                    grace period expired
                  </span>
                </div>
              )}
              {day.is_override && day.can_edit && (
                <span className="text-xs text-neutral-500">(overridden for this day)</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
