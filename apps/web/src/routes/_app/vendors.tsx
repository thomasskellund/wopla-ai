import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { EntityGeneralForm } from '#/components/virksomheder/entity-general-form'
import { VendorSettings } from '#/components/virksomheder/vendor-settings'
import { useCreateVendor, useVendors } from '#/lib/queries/virksomheder'

export const Route = createFileRoute('/_app/vendors')({
  component: VendorsPage,
})

function VendorsPage() {
  const { user } = Route.useRouteContext()

  if (user.role === 'vendor_admin') {
    return (
      <div className="max-w-4xl">
        <h1 className="mb-4 text-lg font-semibold">Your vendor</h1>
        <VendorSettings vendorId={user.vendorId as string} />
      </div>
    )
  }

  if (user.role !== 'admin') {
    return <p className="text-sm text-neutral-500">Vendors aren't visible to this role.</p>
  }

  return <AdminVendorsView />
}

function AdminVendorsView() {
  const { data: vendors } = useVendors()
  const createVendor = useCreateVendor()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Vendors</h1>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium"
        >
          + New vendor
        </button>
      </div>

      {showCreate && (
        <div className="rounded-md border border-[var(--border)] p-4">
          <EntityGeneralForm
            onSave={(args) =>
              createVendor.mutate(args, {
                onSuccess: (data) => {
                  setShowCreate(false)
                  setSelectedId(data.id)
                },
              })
            }
            isSaving={createVendor.isPending}
            submitLabel="Create vendor"
          />
          {createVendor.isError && <p className="mt-2 text-xs text-red-600">{(createVendor.error as Error).message}</p>}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <ul className="space-y-1 text-sm">
          {vendors?.map((v) => (
            <li key={v.id}>
              <button
                onClick={() => setSelectedId(v.id)}
                className={`w-full rounded-md px-2 py-1.5 text-left ${
                  selectedId === v.id ? 'bg-neutral-100 font-medium' : 'hover:bg-neutral-50'
                }`}
              >
                {v.name}
              </button>
            </li>
          ))}
        </ul>
        <div>
          {selectedId ? <VendorSettings vendorId={selectedId} /> : <p className="text-sm text-neutral-500">Select a vendor to manage it.</p>}
        </div>
      </div>
    </div>
  )
}
