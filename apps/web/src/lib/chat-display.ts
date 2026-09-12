import type { AppRole } from '@wopla-ai/shared'

export type ChatRoomRow = {
  id: string
  room_type: 'admin_company' | 'admin_vendor' | 'company_vendor' | 'custom_group'
  company_name: string | null
  vendor_name: string | null
  name: string | null
}

/** Mirrors legacy's per-viewer room title matrix (see docs/specs/002-chat-domain.md §8). */
export function chatRoomDisplayName(room: ChatRoomRow, viewerRole: AppRole): string {
  switch (room.room_type) {
    case 'admin_company':
      return viewerRole === 'admin' ? (room.company_name ?? 'Company') : 'Wopla Admin'
    case 'admin_vendor':
      return viewerRole === 'admin' ? (room.vendor_name ?? 'Vendor') : 'Wopla Admin'
    case 'company_vendor':
      return viewerRole === 'vendor_admin' ? (room.company_name ?? 'Company') : (room.vendor_name ?? 'Vendor')
    case 'custom_group':
      return room.name ?? 'Group'
  }
}
