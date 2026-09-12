import type { AppRole } from '@wopla-ai/shared'
import { useState } from 'react'
import { chatRoomDisplayName } from '#/lib/chat-display'
import { useChatRooms } from '#/lib/queries/chat'

type Props = {
  viewerRole: AppRole
  selectedRoomId: string | null
  onSelect: (roomId: string) => void
  onNewGroup: () => void
}

export function ChatRoomList({ viewerRole, selectedRoomId, onSelect, onNewGroup }: Props) {
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const [keyword, setKeyword] = useState('')
  const { data: rooms, isLoading } = useChatRooms(tab === 'archived', keyword)

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r border-[var(--border)]">
      <div className="space-y-2 border-b border-[var(--border)] p-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-1 rounded-md bg-neutral-100 p-0.5 text-sm">
            {(['active', 'archived'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded px-2.5 py-1 capitalize ${
                  tab === t ? 'bg-white shadow-sm' : 'text-neutral-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {viewerRole === 'admin' && (
            <button
              onClick={onNewGroup}
              className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium hover:bg-neutral-50"
            >
              + Group
            </button>
          )}
        </div>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search rooms and messages…"
          className="w-full rounded-md border border-[var(--border)] px-2.5 py-1.5 text-sm"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="p-3 text-sm text-neutral-500">Loading…</p>}
        {rooms?.length === 0 && <p className="p-3 text-sm text-neutral-500">No rooms here.</p>}
        {rooms?.map((room) => {
          const displayName = chatRoomDisplayName(room, viewerRole)
          const isSelected = room.id === selectedRoomId
          return (
            <button
              key={room.id}
              onClick={() => onSelect(room.id)}
              className={`flex w-full flex-col gap-0.5 border-b border-[var(--border)] px-3 py-2.5 text-left ${
                isSelected ? 'bg-[var(--accent-tint,#eef4ea)]' : 'hover:bg-neutral-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{displayName}</span>
                {room.unread_count > 0 && (
                  <span className="rounded-full bg-[var(--destructive)] px-1.5 py-0.5 text-xs font-medium text-white">
                    {room.unread_count}
                  </span>
                )}
              </div>
              {room.last_message_preview && (
                <span className="truncate text-xs text-neutral-500">{room.last_message_preview}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
