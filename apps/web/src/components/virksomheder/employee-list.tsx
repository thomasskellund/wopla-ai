import { useState } from 'react'
import { useCreateAccount, useSetEmployeeStatus } from '#/lib/queries/virksomheder'

type Employee = { id: string; full_name: string; role: string; status: string }

type Props = {
  employees: Employee[] | undefined
  isLoading: boolean
  scope: { companyId: string } | { vendorId: string }
  creatableRoles: { value: 'employee' | 'company_admin' | 'vendor_admin'; label: string }[]
}

export function EmployeeList({ employees, isLoading, scope, creatableRoles }: Props) {
  const createAccount = useCreateAccount()
  const setStatus = useSetEmployeeStatus()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState(creatableRoles[0]?.value ?? 'employee')
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null)

  const statusArgs = 'companyId' in scope ? { companyId: scope.companyId } : { vendorId: scope.vendorId }

  return (
    <div className="max-w-2xl space-y-4">
      {credentials && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-800">Account created — share these once, they won't be shown again:</p>
          <p className="mt-1 font-mono text-amber-900">
            {credentials.email} / {credentials.password}
          </p>
          <button onClick={() => setCredentials(null)} className="mt-2 text-xs text-amber-700 underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 rounded-md bg-neutral-50 p-2">
        <label className="text-xs text-neutral-500">
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-48 rounded border border-[var(--border)] px-1.5 py-1"
          />
        </label>
        <label className="text-xs text-neutral-500">
          Full name
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 block w-40 rounded border border-[var(--border)] px-1.5 py-1"
          />
        </label>
        {creatableRoles.length > 1 && (
          <label className="text-xs text-neutral-500">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="mt-1 block rounded border border-[var(--border)] px-1.5 py-1"
            >
              {creatableRoles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          disabled={!email || !fullName || createAccount.isPending}
          onClick={() =>
            createAccount.mutate(
              { email, fullName, role, ...scope },
              {
                onSuccess: (data) => {
                  setCredentials(data)
                  setEmail('')
                  setFullName('')
                },
              },
            )
          }
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {createAccount.isError && <p className="text-xs text-red-600">{(createAccount.error as Error).message}</p>}

      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="border-b border-[var(--border)] py-1.5 pr-3 font-medium">Name</th>
            <th className="border-b border-[var(--border)] py-1.5 pr-3 font-medium">Role</th>
            <th className="border-b border-[var(--border)] py-1.5 pr-3 font-medium">Status</th>
            <th className="border-b border-[var(--border)] py-1.5 font-medium" />
          </tr>
        </thead>
        <tbody>
          {employees?.map((e) => (
            <tr key={e.id}>
              <td className="border-b border-[var(--border)] py-1.5 pr-3">{e.full_name}</td>
              <td className="border-b border-[var(--border)] py-1.5 pr-3 text-neutral-500">{e.role}</td>
              <td className="border-b border-[var(--border)] py-1.5 pr-3">
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    e.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {e.status}
                </span>
              </td>
              <td className="border-b border-[var(--border)] py-1.5 text-right">
                <button
                  onClick={() =>
                    setStatus.mutate({ profileId: e.id, status: e.status === 'active' ? 'inactive' : 'active', ...statusArgs })
                  }
                  className="text-xs text-neutral-500 hover:underline"
                >
                  {e.status === 'active' ? 'Deactivate' : 'Reactivate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
