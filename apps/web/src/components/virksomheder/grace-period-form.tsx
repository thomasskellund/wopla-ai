import { useEffect, useState } from 'react'
import { useGracePeriod, useSetGracePeriod } from '#/lib/queries/virksomheder'

const DEFAULTS = {
  minorUpdateDays: 1,
  minorUpdateTime: '10:00',
  majorUpdateDays: 5,
  majorUpdateTime: '10:00',
  cancellationDays: 1,
  cancellationTime: '10:00',
  cancelGracePeriod: false,
  threshold: 5,
}

export function GracePeriodForm({ companyId }: { companyId: string }) {
  const { data } = useGracePeriod(companyId, 1)
  const setGracePeriod = useSetGracePeriod(companyId, 1)
  const [form, setForm] = useState(DEFAULTS)

  useEffect(() => {
    if (data) {
      setForm({
        minorUpdateDays: data.minor_update_days,
        minorUpdateTime: data.minor_update_time.slice(0, 5),
        majorUpdateDays: data.major_update_days,
        majorUpdateTime: data.major_update_time.slice(0, 5),
        cancellationDays: data.cancellation_days,
        cancellationTime: data.cancellation_time.slice(0, 5),
        cancelGracePeriod: data.cancel_grace_period,
        threshold: data.threshold,
      })
    }
  }, [data])

  return (
    <div className="max-w-md space-y-3">
      <p className="text-xs text-neutral-500">Lunch (module 1) only, this pass.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-neutral-500">
          Minor update — working days before
          <input
            type="number"
            value={form.minorUpdateDays}
            onChange={(e) => setForm((f) => ({ ...f, minorUpdateDays: Number(e.target.value) }))}
            className="mt-1 block w-full rounded border border-[var(--border)] px-1.5 py-1"
          />
        </label>
        <label className="text-xs text-neutral-500">
          Minor update — cutoff time
          <input
            type="time"
            value={form.minorUpdateTime}
            onChange={(e) => setForm((f) => ({ ...f, minorUpdateTime: e.target.value }))}
            className="mt-1 block w-full rounded border border-[var(--border)] px-1.5 py-1"
          />
        </label>
        <label className="text-xs text-neutral-500">
          Major update — working days before (Monday-anchored)
          <input
            type="number"
            value={form.majorUpdateDays}
            onChange={(e) => setForm((f) => ({ ...f, majorUpdateDays: Number(e.target.value) }))}
            className="mt-1 block w-full rounded border border-[var(--border)] px-1.5 py-1"
          />
        </label>
        <label className="text-xs text-neutral-500">
          Major update — cutoff time
          <input
            type="time"
            value={form.majorUpdateTime}
            onChange={(e) => setForm((f) => ({ ...f, majorUpdateTime: e.target.value }))}
            className="mt-1 block w-full rounded border border-[var(--border)] px-1.5 py-1"
          />
        </label>
        <label className="text-xs text-neutral-500">
          Cancellation — working days before
          <input
            type="number"
            value={form.cancellationDays}
            onChange={(e) => setForm((f) => ({ ...f, cancellationDays: Number(e.target.value) }))}
            className="mt-1 block w-full rounded border border-[var(--border)] px-1.5 py-1"
          />
        </label>
        <label className="text-xs text-neutral-500">
          Cancellation — cutoff time
          <input
            type="time"
            value={form.cancellationTime}
            onChange={(e) => setForm((f) => ({ ...f, cancellationTime: e.target.value }))}
            className="mt-1 block w-full rounded border border-[var(--border)] px-1.5 py-1"
          />
        </label>
        <label className="text-xs text-neutral-500">
          Threshold (heads changed before it's "major")
          <input
            type="number"
            value={form.threshold}
            onChange={(e) => setForm((f) => ({ ...f, threshold: Number(e.target.value) }))}
            className="mt-1 block w-full rounded border border-[var(--border)] px-1.5 py-1"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-neutral-500">
        <input
          type="checkbox"
          checked={form.cancelGracePeriod}
          onChange={(e) => setForm((f) => ({ ...f, cancelGracePeriod: e.target.checked }))}
        />
        Cancellation follows the minor-update rule instead of the major one
      </label>
      <button
        onClick={() => setGracePeriod.mutate(form)}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
      >
        Save grace period
      </button>
    </div>
  )
}
