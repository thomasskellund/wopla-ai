import { useMemo, useState } from 'react'
import { localISODate } from '#/lib/dates'
import { useRecordExtraHeads, useVendorHeadcount } from '#/lib/queries/ordering'

type Props = { vendorId: string }

export function VendorHeadcount({ vendorId }: Props) {
  const [orderDate, setOrderDate] = useState(() => localISODate())
  const { data: rows, isLoading } = useVendorHeadcount(vendorId, orderDate)
  const recordExtra = useRecordExtraHeads(vendorId, orderDate)
  const [extraFor, setExtraFor] = useState<string | null>(null)
  const [extraAmount, setExtraAmount] = useState(1)
  const [extraNote, setExtraNote] = useState('')

  const byCompany = useMemo(() => {
    const groups = new Map<string, { name: string; rows: NonNullable<typeof rows> }>()
    for (const row of rows ?? []) {
      const g = groups.get(row.company_id) ?? { name: row.company_name ?? '', rows: [] }
      g.rows.push(row)
      groups.set(row.company_id, g)
    }
    return [...groups.values()]
  }, [rows])

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-neutral-700">Date</label>
        <input
          type="date"
          value={orderDate}
          onChange={(e) => setOrderDate(e.target.value)}
          className="rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
        />
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {byCompany.length === 0 && !isLoading && <p className="text-sm text-neutral-500">No orders for this date.</p>}

      {byCompany.map((group) => (
        <div key={group.rows[0]?.company_id} className="rounded-md border border-[var(--border)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium">{group.name}</h3>
            {group.rows[0]?.status === 'cancelled' && (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">cancelled</span>
            )}
            {group.rows[0]?.status === 'locked' && (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">locked</span>
            )}
          </div>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {group.rows.map((row) => (
                <tr key={row.dish_id}>
                  <td className="border-b border-[var(--border)] py-1.5">{row.dish_name}</td>
                  <td className="border-b border-[var(--border)] py-1.5 text-right tabular-nums">{row.heads}</td>
                  <td className="border-b border-[var(--border)] py-1.5 pl-3 text-right">
                    <button
                      onClick={() => setExtraFor(row.daily_order_id + ':' + row.dish_id)}
                      className="text-xs text-neutral-500 hover:underline"
                    >
                      + Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {group.rows.some((r) => extraFor === r.daily_order_id + ':' + r.dish_id) && (
            <div className="mt-2 flex items-end gap-2 rounded-md bg-neutral-50 p-2">
              <label className="text-xs text-neutral-500">
                Extra heads
                <input
                  type="number"
                  value={extraAmount}
                  onChange={(e) => setExtraAmount(Number(e.target.value))}
                  className="mt-1 block w-20 rounded border border-[var(--border)] px-1.5 py-1"
                />
              </label>
              <label className="flex-1 text-xs text-neutral-500">
                Note
                <input
                  value={extraNote}
                  onChange={(e) => setExtraNote(e.target.value)}
                  placeholder="e.g. phoned in"
                  className="mt-1 block w-full rounded border border-[var(--border)] px-1.5 py-1"
                />
              </label>
              <button
                onClick={() => {
                  const [dailyOrderId, dishId] = (extraFor as string).split(':')
                  recordExtra.mutate(
                    { dailyOrderId, dishId, extraHeads: extraAmount, note: extraNote || undefined },
                    { onSuccess: () => setExtraFor(null) },
                  )
                }}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
              >
                Save
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
