import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '#/lib/supabase/client'

export const Route = createFileRoute('/_app/')({
  component: Dashboard,
})

function Dashboard() {
  const { user } = Route.useRouteContext()

  const { data: peers, isLoading } = useQuery({
    queryKey: ['profiles', 'peers'],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .order('full_name')
      if (error) throw error
      return data
    },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Welcome, {user.fullName}</h1>
        <p className="text-sm text-neutral-500">
          Signed in as <span className="font-medium">{user.role}</span>
          {user.companyId && <> · company {user.companyId}</>}
          {user.vendorId && <> · vendor {user.vendorId}</>}
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-2 text-sm font-semibold text-neutral-500">
          Profiles visible to you (RLS-filtered)
        </h2>
        {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
        <ul className="space-y-1 text-sm">
          {peers?.map((p) => (
            <li key={p.id} className="flex justify-between">
              <span>{p.full_name}</span>
              <span className="text-neutral-500">{p.role}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
