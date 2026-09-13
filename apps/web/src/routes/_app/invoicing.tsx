import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { AdminBillingSetup } from '#/components/invoicing/admin-billing-setup'
import { InvoiceDetail } from '#/components/invoicing/invoice-detail'
import { InvoiceList } from '#/components/invoicing/invoice-list'

export const Route = createFileRoute('/_app/invoicing')({
  component: InvoicingPage,
})

function InvoicingPage() {
  const { user } = Route.useRouteContext()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (user.role === 'employee') {
    return <p className="text-sm text-neutral-500">Invoicing isn't visible to employees.</p>
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-lg font-semibold">Invoicing</h1>

      {user.role === 'admin' && <AdminBillingSetup onInvoiceCreated={setSelectedId} />}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-medium text-neutral-700">
            {user.role === 'admin' ? 'All invoices' : 'Your invoices'}
          </h2>
          <InvoiceList selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div>
          {selectedId ? (
            <InvoiceDetail invoiceId={selectedId} canManage={user.role === 'admin'} />
          ) : (
            <p className="text-sm text-neutral-500">Select an invoice to see its details.</p>
          )}
        </div>
      </div>
    </div>
  )
}
