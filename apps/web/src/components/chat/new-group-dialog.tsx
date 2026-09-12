import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getSupabaseBrowserClient } from '#/lib/supabase/client'

type Props = {
  onClose: () => void
  onCreated: (roomId: string) => void
}

export function NewGroupDialog({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState(false)
  const queryClient = useQueryClient()

  const { data: candidates } = useQuery({
    queryKey: ['profiles', 'chat-group-candidates'],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['company_admin', 'vendor_admin'])
        .order('full_name')
      if (error) throw error
      return data
    },
  })

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function onCreate() {
    if (!name.trim() || selected.size === 0) return
    setPending(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .schema('api')
        .rpc('create_custom_group', { p_name: name.trim(), p_member_profile_ids: [...selected] })
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['chat_rooms'] })
      onCreated(data.id)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-lg">
        <h2 className="font-medium">New custom group</h2>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Group name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Members</label>
          <div className="max-h-60 overflow-y-auto rounded-md border border-[var(--border)]">
            {candidates?.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-sm last:border-b-0 hover:bg-neutral-50"
              >
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                {c.full_name} <span className="text-xs text-neutral-500">({c.role})</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            onClick={onCreate}
            disabled={!name.trim() || selected.size === 0 || pending}
            className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
