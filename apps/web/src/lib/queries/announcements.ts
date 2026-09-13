import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '#/lib/supabase/client'

export function useAnnouncements(enabled: boolean) {
  return useQuery({
    queryKey: ['announcements'],
    enabled,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.schema('api').rpc('list_announcements')
      if (error) throw error
      return data
    },
    refetchInterval: false,
  })
}

export function useUnreadAnnouncementCount(enabled: boolean) {
  return useAnnouncements(enabled).data?.filter((a) => !a.is_read).length ?? 0
}

export function useMarkAnnouncementRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.schema('api').rpc('mark_announcement_read', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
  })
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { title: string; body: string }) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .schema('api')
        .rpc('create_announcement', { p_title: args.title, p_body: args.body, p_expires_at: undefined })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
  })
}
