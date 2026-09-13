import { createFileRoute } from '@tanstack/react-router'
import { CompanyAdminOrder } from '#/components/ordering/company-admin-order'
import { EmployeeWeek } from '#/components/ordering/employee-week'
import { VendorHeadcount } from '#/components/ordering/vendor-headcount'
import { useMyCompanyMode, useMyOrder } from '#/lib/queries/ordering'

export const Route = createFileRoute('/_app/ordering')({
  component: OrderingPage,
})

function OrderingPage() {
  const { user } = Route.useRouteContext()

  if (user.role === 'admin') {
    return (
      <p className="text-sm text-neutral-500">
        Admin doesn't have a dedicated ordering view yet — log in as a company_admin, employee, or vendor_admin to
        use this domain.
      </p>
    )
  }

  if (user.role === 'vendor_admin') {
    return (
      <div>
        <h1 className="mb-4 text-lg font-semibold">Today's headcount</h1>
        <VendorHeadcount vendorId={user.vendorId as string} />
      </div>
    )
  }

  return <CompanyOrderingView companyId={user.companyId as string} role={user.role} />
}

function CompanyOrderingView({ companyId, role }: { companyId: string; role: 'company_admin' | 'employee' }) {
  const { data: order, isLoading: orderLoading } = useMyOrder()
  const { data: adminManaged, isLoading: modeLoading } = useMyCompanyMode(companyId)

  if (orderLoading || modeLoading) return <p className="text-sm text-neutral-500">Loading…</p>

  if (role === 'company_admin') {
    return (
      <div>
        <h1 className="mb-4 text-lg font-semibold">Ordering</h1>
        <CompanyAdminOrder companyId={companyId} order={order ?? null} adminManaged={!!adminManaged} />
      </div>
    )
  }

  if (!order) {
    return <p className="text-sm text-neutral-500">No standing lunch order yet — ask your company admin to set one up.</p>
  }
  if (adminManaged) {
    return (
      <p className="text-sm text-neutral-500">
        Your company's lunch is managed by your company admin — there's nothing to set here.
      </p>
    )
  }
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Your lunch</h1>
      <EmployeeWeek orderId={order.id} vendorId={order.vendor_id} />
    </div>
  )
}
