import { useNavigate } from '@tanstack/react-router'
import { BellIcon } from '#/components/layout/icons'
import { useChatUnreadTotal } from '#/lib/queries/chat'

// The bell surfaces the one real "needs your attention" signal that exists
// today — unread chat messages — rather than a second, disconnected
// notifications feed. Clicking it goes straight to chat.
export function NotificationBell({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate()
  const { data: unreadTotal } = useChatUnreadTotal(enabled)

  if (!enabled) return null

  return (
    <button
      type="button"
      onClick={() => navigate({ to: '/chat' })}
      aria-label={unreadTotal ? `${unreadTotal} unread chat messages` : 'Chat notifications'}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--foreground)] hover:bg-[var(--muted)]"
    >
      <BellIcon className="h-5 w-5" />
      {!!unreadTotal && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--destructive)] px-1 text-[10px] font-medium text-white">
          {unreadTotal > 9 ? '9+' : unreadTotal}
        </span>
      )}
    </button>
  )
}
