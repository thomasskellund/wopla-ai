import { useState } from 'react'
import type { Database } from '@wopla-ai/shared'
import { localISODate } from '#/lib/dates'
import { useCompanies, useCreateInvoice, useOrdersForBilling, useSetBillingRate, useVendorsForBilling } from '#/lib/queries/invoicing'

type InvoiceType = Database['public']['Enums']['invoice_type']

export function AdminBillingSetup({ onInvoiceCreated }: { onInvoiceCreated: (id: string) => void }) {
  const { data: orders } = useOrdersForBilling()
  const { data: companies } = useCompanies()
  const { data: vendors } = useVendorsForBilling()
  const setRate = useSetBillingRate()
  const createInvoice = useCreateInvoice()

  const [rateOrderId, setRateOrderId] = useState('')
  const [vendorRate, setVendorRate] = useState(0)
  const [companyRate, setCompanyRate] = useState(0)
  const [kickback, setKickback] = useState(0)

  const [invoiceType, setInvoiceType] = useState<InvoiceType>('wopla_to_customer')
  const [counterpartyId, setCounterpartyId] = useState('')
  const [fromDate, setFromDate] = useState(() => localISODate())
  const [toDate, setToDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return localISODate(d)
  })

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-md border border-[var(--border)] p-4">
        <h3 className="mb-2 text-sm font-medium">Set a billing rate</h3>
        <p className="mb-3 text-xs text-neutral-500">
          The minimal contract stand-in — per-head prices for a standing order.
        </p>
        <div className="space-y-2">
          <select
            value={rateOrderId}
            onChange={(e) => setRateOrderId(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
          >
            <option value="">Choose an order…</option>
            {orders?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.companies?.name} ↔ {o.vendors?.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-neutral-500">
              Vendor rate (kr/head)
              <input
                type="number"
                value={vendorRate}
                onChange={(e) => setVendorRate(Number(e.target.value))}
                className="mt-1 block w-full rounded border border-[var(--border)] px-1.5 py-1"
              />
            </label>
            <label className="flex-1 text-xs text-neutral-500">
              Customer rate (kr/head)
              <input
                type="number"
                value={companyRate}
                onChange={(e) => setCompanyRate(Number(e.target.value))}
                className="mt-1 block w-full rounded border border-[var(--border)] px-1.5 py-1"
              />
            </label>
            <label className="flex-1 text-xs text-neutral-500">
              Kickback %
              <input
                type="number"
                value={kickback}
                onChange={(e) => setKickback(Number(e.target.value))}
                className="mt-1 block w-full rounded border border-[var(--border)] px-1.5 py-1"
              />
            </label>
          </div>
          <button
            disabled={!rateOrderId}
            onClick={() =>
              setRate.mutate({
                orderId: rateOrderId,
                vendorPerHeadPrice: vendorRate,
                companyPerHeadPrice: companyRate,
                kickbackPercentage: kickback,
                fromDate: localISODate(),
              })
            }
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            Set rate (effective today)
          </button>
          {setRate.isError && <p className="text-xs text-red-600">{(setRate.error as Error).message}</p>}
        </div>
      </div>

      <div className="rounded-md border border-[var(--border)] p-4">
        <h3 className="mb-2 text-sm font-medium">Create an invoice</h3>
        <div className="space-y-2">
          <select
            value={invoiceType}
            onChange={(e) => {
              setInvoiceType(e.target.value as InvoiceType)
              setCounterpartyId('')
            }}
            className="w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
          >
            <option value="wopla_to_customer">Customer invoice (Wopla → company)</option>
            <option value="vendor_to_wopla">Vendor invoice (vendor → Wopla)</option>
          </select>
          <select
            value={counterpartyId}
            onChange={(e) => setCounterpartyId(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
          >
            <option value="">Choose {invoiceType === 'wopla_to_customer' ? 'a company' : 'a vendor'}…</option>
            {(invoiceType === 'wopla_to_customer' ? companies : vendors)?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-neutral-500">
              From
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 block w-full rounded border border-[var(--border)] px-1.5 py-1"
              />
            </label>
            <label className="flex-1 text-xs text-neutral-500">
              To
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 block w-full rounded border border-[var(--border)] px-1.5 py-1"
              />
            </label>
          </div>
          <button
            disabled={!counterpartyId}
            onClick={() =>
              createInvoice.mutate(
                { type: invoiceType, counterpartyId, fromDate, toDate },
                { onSuccess: (data) => onInvoiceCreated(data.id) },
              )
            }
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            Create invoice
          </button>
          {createInvoice.isError && <p className="text-xs text-red-600">{(createInvoice.error as Error).message}</p>}
        </div>
      </div>
    </div>
  )
}
