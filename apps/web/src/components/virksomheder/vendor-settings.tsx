import { useState } from 'react'
import { EntityGeneralForm } from '#/components/virksomheder/entity-general-form'
import { EmployeeList } from '#/components/virksomheder/employee-list'
import { useUpdateVendor, useVendorStaff, useVendors } from '#/lib/queries/virksomheder'

const TABS = ['General', 'Staff'] as const

export function VendorSettings({ vendorId }: { vendorId: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('General')
  const { data: vendors } = useVendors()
  const vendor = vendors?.find((v) => v.id === vendorId)
  const updateVendor = useUpdateVendor(vendorId)
  const { data: staff, isLoading: staffLoading } = useVendorStaff(vendorId)

  return (
    <div>
      <div className="mb-4 flex gap-4 border-b border-[var(--border)] text-sm">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 pb-2 ${tab === t ? 'border-neutral-900 font-medium' : 'border-transparent text-neutral-500'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'General' &&
        (vendor ? (
          <EntityGeneralForm
            initial={vendor}
            onSave={(args) => updateVendor.mutate(args)}
            isSaving={updateVendor.isPending}
            submitLabel="Save"
          />
        ) : (
          <p className="text-sm text-neutral-500">Loading…</p>
        ))}
      {tab === 'Staff' && (
        <EmployeeList
          employees={staff}
          isLoading={staffLoading}
          scope={{ vendorId }}
          creatableRoles={[{ value: 'vendor_admin', label: 'Vendor admin' }]}
        />
      )}
    </div>
  )
}
