import { useState } from 'react'
import { localISODate } from '#/lib/dates'
import {
  useAvailableVendors,
  useCancelDailyOrder,
  useCreateOrder,
  useDishes,
  useSaveOrderDishHeads,
  useStandingHeads,
  useUncancelDailyOrder,
} from '#/lib/queries/ordering'
import type { Database } from '@wopla-ai/shared'

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const
const WEEKDAY_LABELS: Record<(typeof WEEKDAYS)[number], string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
}

type Order = Database['public']['Tables']['orders']['Row']

function BootstrapOrder({ companyId }: { companyId: string }) {
  const { data: vendors } = useAvailableVendors(true)
  const [vendorId, setVendorId] = useState('')
  const [fromDate, setFromDate] = useState(() => localISODate())
  const createOrder = useCreateOrder()

  return (
    <div className="max-w-md space-y-3 rounded-md border border-[var(--border)] p-4">
      <h2 className="text-sm font-medium">No standing lunch order yet</h2>
      <p className="text-xs text-neutral-500">Link a vendor to start ordering. This is a one-time setup step.</p>
      <label className="block text-xs text-neutral-500">
        Vendor
        <select
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm text-neutral-900"
        >
          <option value="">Choose a vendor…</option>
          {vendors?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-neutral-500">
        Start date
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm text-neutral-900"
        />
      </label>
      <button
        disabled={!vendorId || createOrder.isPending}
        onClick={() => createOrder.mutate({ companyId, vendorId, fromDate })}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
      >
        Create standing order
      </button>
      {createOrder.isError && <p className="text-xs text-red-600">{(createOrder.error as Error).message}</p>}
    </div>
  )
}

function AdminManagedHeads({ order }: { order: Order }) {
  const { data: dishes } = useDishes(order.vendor_id)
  const { data: heads } = useStandingHeads(order.id)
  const saveHeads = useSaveOrderDishHeads(order.id)

  function headsFor(dishId: string, weekday: string) {
    return heads?.find((h) => h.dish_id === dishId && h.weekday === weekday)?.heads ?? 0
  }

  return (
    <div>
      <h2 className="mb-2 text-sm font-medium text-neutral-700">Standing head counts</h2>
      <p className="mb-3 text-xs text-neutral-500">
        This company is admin-managed — you type head counts directly per dish, per weekday. Employees don't order
        individually.
      </p>
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-[var(--border)] px-3 py-1.5 text-left font-medium">Dish</th>
            {WEEKDAYS.map((wd) => (
              <th key={wd} className="border-b border-[var(--border)] px-3 py-1.5 text-center font-medium">
                {WEEKDAY_LABELS[wd]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dishes?.map((dish) => (
            <tr key={dish.id}>
              <td className="border-b border-[var(--border)] px-3 py-1.5">{dish.name}</td>
              {WEEKDAYS.map((wd) => (
                <td key={wd} className="border-b border-[var(--border)] px-1.5 py-1">
                  <input
                    type="number"
                    min={0}
                    defaultValue={headsFor(dish.id, wd)}
                    onBlur={(e) => {
                      const value = Number(e.target.value) || 0
                      saveHeads.mutate({ dishId: dish.id, weekdayHeads: { [wd]: value } })
                    }}
                    className="w-16 rounded border border-[var(--border)] px-1.5 py-1 text-center"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EmployeeManagedOverview({ order }: { order: Order }) {
  const { data: dishes } = useDishes(order.vendor_id)
  const { data: heads } = useStandingHeads(order.id)
  const [cancelDate, setCancelDate] = useState('')
  const [cancelNote, setCancelNote] = useState('')
  const cancelDailyOrder = useCancelDailyOrder(order.id)
  const uncancelDailyOrder = useUncancelDailyOrder(order.id)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-medium text-neutral-700">Standing heads (tallied from employee choices)</h2>
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-[var(--border)] px-3 py-1.5 text-left font-medium">Dish</th>
              {WEEKDAYS.map((wd) => (
                <th key={wd} className="border-b border-[var(--border)] px-3 py-1.5 text-center font-medium">
                  {WEEKDAY_LABELS[wd]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dishes?.map((dish) => (
              <tr key={dish.id}>
                <td className="border-b border-[var(--border)] px-3 py-1.5">{dish.name}</td>
                {WEEKDAYS.map((wd) => (
                  <td key={wd} className="border-b border-[var(--border)] px-3 py-1.5 text-center tabular-nums">
                    {heads?.find((h) => h.dish_id === dish.id && h.weekday === wd)?.heads ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="max-w-sm space-y-2 rounded-md border border-[var(--border)] p-4">
        <h2 className="text-sm font-medium">Cancel a date</h2>
        <p className="text-xs text-neutral-500">Propagates to every employee's daily choice for that date.</p>
        <input
          type="date"
          value={cancelDate}
          onChange={(e) => setCancelDate(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
        />
        <input
          value={cancelNote}
          onChange={(e) => setCancelNote(e.target.value)}
          placeholder="Reason (optional)"
          className="w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
        />
        <div className="flex gap-2">
          <button
            disabled={!cancelDate}
            onClick={() => cancelDailyOrder.mutate({ orderDate: cancelDate, note: cancelNote || undefined })}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Cancel date
          </button>
          <button
            disabled={!cancelDate}
            onClick={() => uncancelDailyOrder.mutate(cancelDate)}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium disabled:opacity-40"
          >
            Un-cancel
          </button>
        </div>
        {(cancelDailyOrder.isError || uncancelDailyOrder.isError) && (
          <p className="text-xs text-red-600">
            {((cancelDailyOrder.error ?? uncancelDailyOrder.error) as Error).message}
          </p>
        )}
      </div>
    </div>
  )
}

type Props = { companyId: string; order: Order | null; adminManaged: boolean }

export function CompanyAdminOrder({ companyId, order, adminManaged }: Props) {
  if (!order) return <BootstrapOrder companyId={companyId} />
  return adminManaged ? <AdminManagedHeads order={order} /> : <EmployeeManagedOverview order={order} />
}
