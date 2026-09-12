import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { NewGroupDialog } from '#/components/chat/new-group-dialog'
import { ChatRoomList } from '#/components/chat/room-list'
import { ChatThread } from '#/components/chat/thread'
import { useChatRooms } from '#/lib/queries/chat'

export const Route = createFileRoute('/_app/chat')({
  beforeLoad: ({ context }) => {
    // Chat is org-level: only admin, company_admin, vendor_admin get it —
    // an employee has no access at all, matching legacy exactly.
    if (context.user.role === 'employee') throw redirect({ to: '/unauthorized' })
  },
  component: ChatPage,
})

function ChatPage() {
  const { user } = Route.useRouteContext()
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [showNewGroup, setShowNewGroup] = useState(false)
  // Reuse whichever tab/keyword combination is currently showing in the list
  // for looking up the selected room's own row (archived flag, names, etc.).
  const { data: activeRooms } = useChatRooms(false, '')
  const { data: archivedRooms } = useChatRooms(true, '')
  const selectedRoom =
    activeRooms?.find((r) => r.id === selectedRoomId) ?? archivedRooms?.find((r) => r.id === selectedRoomId)

  return (
    <div className="-m-6 flex h-[calc(100vh-57px)]">
      <ChatRoomList
        viewerRole={user.role}
        selectedRoomId={selectedRoomId}
        onSelect={setSelectedRoomId}
        onNewGroup={() => setShowNewGroup(true)}
      />
      {selectedRoom ? (
        <ChatThread room={selectedRoom} viewerRole={user.role} viewerId={user.id} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
          Select a conversation to get started.
        </div>
      )}
      {showNewGroup && (
        <NewGroupDialog
          onClose={() => setShowNewGroup(false)}
          onCreated={(roomId) => {
            setShowNewGroup(false)
            setSelectedRoomId(roomId)
          }}
        />
      )}
    </div>
  )
}
