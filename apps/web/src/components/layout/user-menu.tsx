import { Link } from '@tanstack/react-router'
import { Avatar } from '#/components/layout/avatar'
import { LockIcon, LogOutIcon } from '#/components/layout/icons'
import { Dropdown } from '#/components/ui/dropdown'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Wopla Admin',
  company_admin: 'Company admin',
  vendor_admin: 'Vendor admin',
  employee: 'Employee',
}

export function UserMenu({
  fullName,
  role,
  tenantName,
  onLogout,
}: {
  fullName: string
  role: string
  tenantName: string | null
  onLogout: () => void
}) {
  return (
    <Dropdown
      label="Account menu"
      triggerClassName="flex h-9 items-center gap-2 rounded-full pl-1 pr-1.5 hover:bg-[var(--muted)]"
      panelClassName="w-64"
      trigger={() => (
        <>
          <Avatar name={fullName} size={28} />
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-medium">{fullName}</span>
            <span className="block text-xs text-[var(--muted-foreground)]">{tenantName ?? ROLE_LABELS[role]}</span>
          </span>
        </>
      )}
    >
      {(close) => (
        <div className="space-y-1">
          <div className="px-2 py-1.5 sm:hidden">
            <p className="text-sm font-medium">{fullName}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{tenantName ?? ROLE_LABELS[role]}</p>
          </div>
          <div className="px-2 pb-1.5 pt-0.5">
            <p className="text-xs text-[var(--muted-foreground)]">{ROLE_LABELS[role]}</p>
          </div>
          <Link
            to="/account"
            onClick={close}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--muted)]"
          >
            <LockIcon className="h-4 w-4 text-[var(--muted-foreground)]" />
            Change password
          </Link>
          <button
            type="button"
            onClick={() => {
              close()
              onLogout()
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[var(--destructive)] hover:bg-[var(--muted)]"
          >
            <LogOutIcon className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </Dropdown>
  )
}
