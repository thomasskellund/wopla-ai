import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { EntityGeneralForm } from '#/components/virksomheder/entity-general-form'
import { CompanySettings } from '#/components/virksomheder/company-settings'
import { useCompanies, useCreateCompany } from '#/lib/queries/virksomheder'

export const Route = createFileRoute('/_app/companies')({
  component: CompaniesPage,
})

function CompaniesPage() {
  const { user } = Route.useRouteContext()

  if (user.role === 'company_admin') {
    return (
      <div className="max-w-4xl">
        <h1 className="mb-4 text-lg font-semibold">Your company</h1>
        <CompanySettings companyId={user.companyId as string} isAdmin={false} />
      </div>
    )
  }

  if (user.role !== 'admin') {
    return <p className="text-sm text-neutral-500">Companies aren't visible to this role.</p>
  }

  return <AdminCompaniesView />
}

function AdminCompaniesView() {
  const { data: companies } = useCompanies()
  const createCompany = useCreateCompany()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Companies</h1>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium"
        >
          + New company
        </button>
      </div>

      {showCreate && (
        <div className="rounded-md border border-[var(--border)] p-4">
          <EntityGeneralForm
            onSave={(args) =>
              createCompany.mutate(args, {
                onSuccess: (data) => {
                  setShowCreate(false)
                  setSelectedId(data.id)
                },
              })
            }
            isSaving={createCompany.isPending}
            submitLabel="Create company"
          />
          {createCompany.isError && <p className="mt-2 text-xs text-red-600">{(createCompany.error as Error).message}</p>}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <ul className="space-y-1 text-sm">
          {companies?.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setSelectedId(c.id)}
                className={`w-full rounded-md px-2 py-1.5 text-left ${
                  selectedId === c.id ? 'bg-neutral-100 font-medium' : 'hover:bg-neutral-50'
                }`}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
        <div>
          {selectedId ? (
            <CompanySettings companyId={selectedId} isAdmin={true} />
          ) : (
            <p className="text-sm text-neutral-500">Select a company to manage it.</p>
          )}
        </div>
      </div>
    </div>
  )
}
