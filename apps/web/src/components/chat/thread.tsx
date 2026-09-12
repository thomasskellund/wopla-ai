import type { AppRole } from '@wopla-ai/shared'
import { useEffect, useRef, useState } from 'react'
import { chatRoomDisplayName, type ChatRoomRow } from '#/lib/chat-display'
import {
  useArchiveChatRoom,
  useChatMessages,
  useChatRealtime,
  useMarkChatRoomRead,
  useMarkChatRoomUnread,
  useSendChatMessage,
} from '#/lib/queries/chat'
import { getSupabaseBrowserClient } from '#/lib/supabase/client'

const URL_RE = /(https?:\/\/[^\s]+)/g

function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE)
  return (
    <>
      {parts.map((part, i) =>
        URL_RE.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noreferrer" className="text-inherit underline">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

async function openAttachment(path: string) {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.storage.from('chat-attachments').createSignedUrl(path, 60)
  if (!error && data) window.open(data.signedUrl, '_blank')
}

type Props = {
  room: ChatRoomRow & { id: string; archived: boolean }
  viewerRole: AppRole
  viewerId: string
}

export function ChatThread({ room, viewerRole, viewerId }: Props) {
  const { data: messages, isLoading } = useChatMessages(room.id)
  useChatRealtime(room.id)
  const sendMessage = useSendChatMessage()
  const markRead = useMarkChatRoomRead()
  const markUnread = useMarkChatRoomUnread()
  const archive = useArchiveChatRoom()
  const [body, setBody] = useState('')
  const [pending, setPending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const listEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    markRead.mutate(room.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  async function onSend(e: React.FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    setBody('')
    await sendMessage.mutateAsync({ roomId: room.id, body: text })
  }

  async function onAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPending(true)
    try {
      const path = `${room.id}/${crypto.randomUUID()}-${file.name}`
      const supabase = getSupabaseBrowserClient()
      const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(path, file)
      if (uploadError) throw uploadError
      await sendMessage.mutateAsync({
        roomId: room.id,
        attachmentPath: path,
        attachmentName: file.name,
        attachmentMime: file.type,
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h2 className="font-medium">{chatRoomDisplayName(room, viewerRole)}</h2>
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => markUnread.mutate(room.id)}
            className="rounded-md border border-[var(--border)] px-2 py-1 hover:bg-neutral-50"
          >
            Mark unread
          </button>
          <button
            onClick={() => archive.mutate({ roomId: room.id, archived: !room.archived })}
            className="rounded-md border border-[var(--border)] px-2 py-1 hover:bg-neutral-50"
          >
            {room.archived ? 'Unarchive' : 'Archive'}
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
        {messages?.map((m) => {
          const isMine = m.sender_id === viewerId
          return (
            <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-md rounded-2xl px-3.5 py-2 text-sm ${
                  isMine ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'bg-neutral-100'
                }`}
              >
                {!isMine && <div className="mb-0.5 text-xs font-medium opacity-70">{m.sender_name}</div>}
                {m.body && <Linkified text={m.body} />}
                {m.attachment_path && (
                  <button
                    onClick={() => openAttachment(m.attachment_path!)}
                    className="mt-1 flex items-center gap-1 underline"
                  >
                    📎 {m.attachment_name}
                  </button>
                )}
              </div>
              <span className="mt-0.5 text-xs text-neutral-400">
                {new Date(m.created_at).toLocaleString('en-DK', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>
          )
        })}
        <div ref={listEndRef} />
      </div>

      <form onSubmit={onSend} className="flex items-end gap-2 border-t border-[var(--border)] p-3">
        <input ref={fileInputRef} type="file" className="hidden" onChange={onAttach} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={pending}
          className="rounded-md border border-[var(--border)] px-2.5 py-2 text-sm disabled:opacity-60"
        >
          📎
        </button>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onSend(e)
          }}
          rows={1}
          placeholder="Write a message… (⌘/Ctrl+Enter to send)"
          className="flex-1 resize-none rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!body.trim() || sendMessage.isPending}
          className="rounded-md bg-[var(--primary)] px-3.5 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  )
}
