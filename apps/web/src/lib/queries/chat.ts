import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { authorizeRealtime, getSupabaseBrowserClient } from '#/lib/supabase/client'

export function useChatRooms(archived: boolean, keyword: string) {
  return useQuery({
    queryKey: ['chat_rooms', archived, keyword],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .schema('api')
        .rpc('list_chat_rooms', { p_archived: archived, p_keyword: keyword || undefined })
      if (error) throw error
      return data
    },
    refetchInterval: false,
  })
}

export function useChatUnreadTotal(enabled: boolean) {
  return useQuery({
    queryKey: ['chat_rooms', false, ''],
    enabled,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .schema('api')
        .rpc('list_chat_rooms', { p_archived: false, p_keyword: undefined })
      if (error) throw error
      return data
    },
    select: (rooms) => rooms.reduce((sum, r) => sum + r.unread_count, 0),
  })
}

export function useChatMessages(roomId: string | null) {
  return useQuery({
    queryKey: ['chat_messages', roomId],
    enabled: !!roomId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .schema('api')
        .rpc('get_chat_messages', { p_room_id: roomId as string, p_limit: 50 })
      if (error) throw error
      return [...data].reverse()
    },
  })
}

/** Subscribes to new messages in the open room and invalidates the caches that need it. */
export function useChatRealtime(roomId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!roomId) return
    let channel: ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null = null
    let cancelled = false

    authorizeRealtime().then((supabase) => {
      if (cancelled) return
      channel = supabase
        .channel(`chat-room-${roomId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
          () => {
            queryClient.invalidateQueries({ queryKey: ['chat_messages', roomId] })
            queryClient.invalidateQueries({ queryKey: ['chat_rooms'] })
          },
        )
        .subscribe()
    })

    return () => {
      cancelled = true
      if (channel) getSupabaseBrowserClient().removeChannel(channel)
    }
  }, [roomId, queryClient])
}

/** Subscribes to the caller's own membership rows, to keep unread badges live everywhere. */
export function useChatUnreadRealtime(profileId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!profileId) return
    let channel: ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null = null
    let cancelled = false

    authorizeRealtime().then((supabase) => {
      if (cancelled) return
      channel = supabase
        .channel(`chat-unread-${profileId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_room_members', filter: `profile_id=eq.${profileId}` },
          () => queryClient.invalidateQueries({ queryKey: ['chat_rooms'] }),
        )
        .subscribe()
    })

    return () => {
      cancelled = true
      if (channel) getSupabaseBrowserClient().removeChannel(channel)
    }
  }, [profileId, queryClient])
}

export function useSendChatMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      roomId: string
      body?: string
      attachmentPath?: string
      attachmentName?: string
      attachmentMime?: string
    }) => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.schema('api').rpc('send_chat_message', {
        p_room_id: args.roomId,
        p_body: args.body,
        p_attachment_path: args.attachmentPath,
        p_attachment_name: args.attachmentName,
        p_attachment_mime: args.attachmentMime,
      })
      if (error) throw error
      return data
    },
    onSuccess: (_data, args) => {
      queryClient.invalidateQueries({ queryKey: ['chat_messages', args.roomId] })
      queryClient.invalidateQueries({ queryKey: ['chat_rooms'] })
    },
  })
}

export function useMarkChatRoomRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (roomId: string) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.schema('api').rpc('mark_chat_room_read', { p_room_id: roomId })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat_rooms'] }),
  })
}

export function useMarkChatRoomUnread() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (roomId: string) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.schema('api').rpc('mark_chat_room_unread', { p_room_id: roomId })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat_rooms'] }),
  })
}

export function useArchiveChatRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { roomId: string; archived: boolean }) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .schema('api')
        .rpc('archive_chat_room', { p_room_id: args.roomId, p_archived: args.archived })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat_rooms'] }),
  })
}
