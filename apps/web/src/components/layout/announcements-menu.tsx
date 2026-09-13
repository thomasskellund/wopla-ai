import { useState } from 'react'
import { MegaphoneIcon } from '#/components/layout/icons'
import { Dropdown } from '#/components/ui/dropdown'
import { useAnnouncements, useCreateAnnouncement, useMarkAnnouncementRead } from '#/lib/queries/announcements'

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days >= 1) return `${days}d ago`
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 1) return `${hours}h ago`
  const minutes = Math.max(1, Math.floor(ms / 60_000))
  return `${minutes}m ago`
}

export function AnnouncementsMenu({ isAdmin }: { isAdmin: boolean }) {
  const { data: announcements } = useAnnouncements(true)
  const markRead = useMarkAnnouncementRead()
  const unreadCount = announcements?.filter((a) => !a.is_read).length ?? 0

  return (
    <Dropdown
      label={unreadCount ? `${unreadCount} unread announcements` : 'Announcements'}
      panelClassName="w-80"
      trigger={() => (
        <>
          <MegaphoneIcon className="h-5 w-5" />
          {!!unreadCount && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--destructive)] px-1 text-[10px] font-medium text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </>
      )}
    >
      {(close) => (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-sm font-semibold">Announcements</span>
          </div>
          {isAdmin && <ComposeAnnouncement />}
          {!announcements?.length && (
            <p className="px-1 py-3 text-sm text-[var(--muted-foreground)]">Nothing posted yet.</p>
          )}
          <ul className="space-y-1">
            {announcements?.map((a) => (
              <li
                key={a.id}
                className={`rounded-md p-2 text-sm ${a.is_read ? '' : 'bg-[var(--accent)]'}`}
                onMouseEnter={() => !a.is_read && markRead.mutate(a.id)}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{a.title}</span>
                  <span className="shrink-0 text-xs text-[var(--muted-foreground)]">{timeAgo(a.created_at)}</span>
                </div>
                <p className="mt-0.5 text-[var(--muted-foreground)]">{a.body}</p>
              </li>
            ))}
          </ul>
          {!!announcements?.length && (
            <button
              type="button"
              onClick={close}
              className="w-full rounded-md px-2 py-1.5 text-center text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            >
              Close
            </button>
          )}
        </div>
      )}
    </Dropdown>
  )
}

function ComposeAnnouncement() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const createAnnouncement = useCreateAnnouncement()

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-dashed border-[var(--border)] px-2 py-1.5 text-left text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
      >
        + Post an announcement
      </button>
    )
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    createAnnouncement.mutate(
      { title, body },
      {
        onSuccess: () => {
          setTitle('')
          setBody('')
          setOpen(false)
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="space-y-1.5 rounded-md border border-[var(--border)] p-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        required
        className="w-full rounded-md border border-[var(--border)] px-2 py-1 text-sm"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What's going on?"
        required
        rows={2}
        className="w-full rounded-md border border-[var(--border)] px-2 py-1 text-sm"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-2 py-1 text-xs text-[var(--muted-foreground)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={createAnnouncement.isPending}
          className="rounded-md bg-[var(--primary)] px-2.5 py-1 text-xs font-medium text-[var(--primary-foreground)] disabled:opacity-60"
        >
          {createAnnouncement.isPending ? 'Posting…' : 'Post'}
        </button>
      </div>
      {createAnnouncement.isError && (
        <p className="text-xs text-[var(--destructive)]">{(createAnnouncement.error as Error).message}</p>
      )}
    </form>
  )
}
