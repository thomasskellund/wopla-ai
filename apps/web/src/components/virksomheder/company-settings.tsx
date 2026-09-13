import { useState } from 'react'
import { EntityGeneralForm } from '#/components/virksomheder/entity-general-form'
import { EmployeeList } from '#/components/virksomheder/employee-list'
import { GracePeriodForm } from '#/components/virksomheder/grace-period-form'
import { HolidaysPanel } from '#/components/virksomheder/holidays-panel'
import { WorkingDaysForm } from '#/components/virksomheder/working-days-form'
import { useCompanies, useCompanyEmployees, useUpdateCompany } from '#/lib/queries/virksomheder'

const TABS = ['General', 'Employees', 'Working days', 'Holidays', 'Grace period'] as const

export function CompanySettings({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('General')
  const { data: companies } = useCompanies()
  const company = companies?.find((c) => c.id === companyId)
  const updateCompany = useUpdateCompany(companyId)
  const { data: employees, isLoading: employeesLoading } = useCompanyEmployees(companyId)

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
        (company ? (
          <EntityGeneralForm
            initial={company}
            onSave={(args) => updateCompany.mutate(args)}
            isSaving={updateCompany.isPending}
            submitLabel="Save"
          />
        ) : (
          <p className="text-sm text-neutral-500">Loading…</p>
        ))}
      {tab === 'Employees' && (
        <EmployeeList
          employees={employees}
          isLoading={employeesLoading}
          scope={{ companyId }}
          creatableRoles={[
            { value: 'employee', label: 'Employee' },
            { value: 'company_admin', label: 'Company admin' },
          ]}
        />
      )}
      {tab === 'Working days' && <WorkingDaysForm companyId={companyId} />}
      {tab === 'Holidays' && <HolidaysPanel companyId={companyId} isAdmin={isAdmin} />}
      {tab === 'Grace period' && <GracePeriodForm companyId={companyId} />}
    </div>
  )
}
