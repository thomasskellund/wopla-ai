import { useState } from 'react'
import {
  useAddManualLineItem,
  useInvoice,
  useInvoiceCreditNotes,
  useInvoiceLineItems,
  useMarkInvoicePaid,
  useRejectInvoice,
  useSubmitInvoice,
} from '#/lib/queries/invoicing'

type Props = { invoiceId: string; canManage: boolean }

export function InvoiceDetail({ invoiceId, canManage }: Props) {
  const { data: invoice, isLoading } = useInvoice(invoiceId)
  const { data: lineItems } = useInvoiceLineItems(invoiceId)
  const { data: creditNotes } = useInvoiceCreditNotes(invoiceId)
  const addLine = useAddManualLineItem(invoiceId)
  const submit = useSubmitInvoice(invoiceId)
  const markPaid = useMarkInvoicePaid(invoiceId)
  const reject = useRejectInvoice(invoiceId)

  const [manualDesc, setManualDesc] = useState('')
  const [manualQty, setManualQty] = useState(1)
  const [manualPrice, setManualPrice] = useState(0)
  const [rejectionReason, setRejectionReason] = useState('')
  const [creditReason, setCreditReason] = useState('')
  const [creditAmount, setCreditAmount] = useState(0)
  const [showReject, setShowReject] = useState(false)

  if (isLoading || !invoice) return <p className="text-sm text-neutral-500">Loading…</p>

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">
          {invoice.type === 'wopla_to_customer' ? 'Customer invoice' : 'Vendor invoice'} · {invoice.status}
        </h3>
        <p className="text-xs text-neutral-500">
          {invoice.from_date} – {invoice.to_date} · VAT {invoice.vat_rate}% · due {invoice.due_date ?? '—'}
        </p>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="border-b border-[var(--border)] py-1.5 pr-3 font-medium">Description</th>
            <th className="border-b border-[var(--border)] py-1.5 pr-3 text-right font-medium">Qty</th>
            <th className="border-b border-[var(--border)] py-1.5 pr-3 text-right font-medium">Unit price</th>
            <th className="border-b border-[var(--border)] py-1.5 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lineItems?.map((li) => (
            <tr key={li.id}>
              <td className="border-b border-[var(--border)] py-1.5 pr-3">{li.description}</td>
              <td className="border-b border-[var(--border)] py-1.5 pr-3 text-right tabular-nums">{li.quantity}</td>
              <td className="border-b border-[var(--border)] py-1.5 pr-3 text-right tabular-nums">{li.unit_price} kr</td>
              <td className="border-b border-[var(--border)] py-1.5 text-right tabular-nums">{li.amount} kr</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="pt-2 text-right text-neutral-500">
              Subtotal
            </td>
            <td className="pt-2 text-right tabular-nums">{invoice.subtotal} kr</td>
          </tr>
          <tr>
            <td colSpan={3} className="text-right text-neutral-500">
              VAT ({invoice.vat_rate}%)
            </td>
            <td className="text-right tabular-nums">{invoice.vat_amount} kr</td>
          </tr>
          <tr>
            <td colSpan={3} className="text-right font-medium">
              Total
            </td>
            <td className="text-right font-medium tabular-nums">{invoice.total} kr</td>
          </tr>
        </tfoot>
      </table>

      {creditNotes && creditNotes.length > 0 && (
        <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm">
          <h4 className="font-medium text-red-700">Credit note{creditNotes.length > 1 ? 's' : ''}</h4>
          {creditNotes.map((cn) => (
            <p key={cn.id} className="text-red-700">
              {cn.amount} kr — {cn.reason}
            </p>
          ))}
          {invoice.rejection_reason && <p className="mt-1 text-xs text-red-600">Rejected: {invoice.rejection_reason}</p>}
        </div>
      )}

      {canManage && invoice.status === 'draft' && (
        <div className="space-y-3">
          <div className="flex items-end gap-2 rounded-md bg-neutral-50 p-2">
            <label className="text-xs text-neutral-500">
              Description
              <input
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
                className="mt-1 block w-40 rounded border border-[var(--border)] px-1.5 py-1"
              />
            </label>
            <label className="text-xs text-neutral-500">
              Qty
              <input
                type="number"
                value={manualQty}
                onChange={(e) => setManualQty(Number(e.target.value))}
                className="mt-1 block w-16 rounded border border-[var(--border)] px-1.5 py-1"
              />
            </label>
            <label className="text-xs text-neutral-500">
              Unit price
              <input
                type="number"
                value={manualPrice}
                onChange={(e) => setManualPrice(Number(e.target.value))}
                className="mt-1 block w-20 rounded border border-[var(--border)] px-1.5 py-1"
              />
            </label>
            <button
              disabled={!manualDesc}
              onClick={() =>
                addLine.mutate(
                  { description: manualDesc, quantity: manualQty, unitPrice: manualPrice },
                  { onSuccess: () => setManualDesc('') },
                )
              }
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              Add line
            </button>
          </div>
          <button
            onClick={() => submit.mutate()}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Submit invoice
          </button>
        </div>
      )}

      {canManage && invoice.status === 'sent' && (
        <div className="flex flex-wrap items-start gap-2">
          <button
            onClick={() => markPaid.mutate()}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Mark paid
          </button>
          <button
            onClick={() => setShowReject((s) => !s)}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium"
          >
            Reject…
          </button>
          {showReject && (
            <div className="w-full space-y-2 rounded-md border border-[var(--border)] p-3">
              <input
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Rejection reason"
                className="w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
              />
              <input
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="Credit note reason"
                className="w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(Number(e.target.value))}
                placeholder="Credit note amount"
                className="w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
              />
              <button
                disabled={!rejectionReason || !creditReason}
                onClick={() =>
                  reject.mutate(
                    { rejectionReason, creditNoteReason: creditReason, creditNoteAmount: creditAmount },
                    { onSuccess: () => setShowReject(false) },
                  )
                }
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Confirm reject + credit note
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
