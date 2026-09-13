import { useInvoices } from '#/lib/queries/invoicing'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  rejected: 'Rejected',
}
const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-neutral-100 text-neutral-600',
  sent: 'bg-blue-50 text-blue-700',
  paid: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
}

type Props = { selectedId: string | null; onSelect: (id: string) => void }

export function InvoiceList({ selectedId, onSelect }: Props) {
  const { data: invoices, isLoading } = useInvoices()

  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>
  if (invoices?.length === 0) return <p className="text-sm text-neutral-500">No invoices yet.</p>

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-left text-neutral-500">
          <th className="border-b border-[var(--border)] py-1.5 pr-3 font-medium">Counterparty</th>
          <th className="border-b border-[var(--border)] py-1.5 pr-3 font-medium">Period</th>
          <th className="border-b border-[var(--border)] py-1.5 pr-3 font-medium">Total</th>
          <th className="border-b border-[var(--border)] py-1.5 pr-3 font-medium">Due</th>
          <th className="border-b border-[var(--border)] py-1.5 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {invoices?.map((inv) => {
          const isOverdue = inv.status === 'sent' && inv.due_date && inv.due_date < new Date().toISOString().slice(0, 10)
          return (
            <tr
              key={inv.id}
              onClick={() => onSelect(inv.id)}
              className={`cursor-pointer ${selectedId === inv.id ? 'bg-neutral-50' : 'hover:bg-neutral-50'}`}
            >
              <td className="border-b border-[var(--border)] py-2 pr-3">
                {inv.type === 'wopla_to_customer' ? inv.companies?.name : inv.vendors?.name}
                <span className="ml-1.5 text-xs text-neutral-400">
                  {inv.type === 'wopla_to_customer' ? '(customer)' : '(vendor)'}
                </span>
              </td>
              <td className="border-b border-[var(--border)] py-2 pr-3 text-xs text-neutral-500">
                {inv.from_date} – {inv.to_date}
              </td>
              <td className="border-b border-[var(--border)] py-2 pr-3 tabular-nums">{inv.total} kr</td>
              <td className="border-b border-[var(--border)] py-2 pr-3 text-xs text-neutral-500">
                {inv.due_date ?? '—'}
                {isOverdue && <span className="ml-1.5 rounded bg-red-50 px-1 py-0.5 text-red-700">overdue</span>}
              </td>
              <td className="border-b border-[var(--border)] py-2">
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_CLASS[inv.status]}`}>
                  {STATUS_LABEL[inv.status]}
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
