import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/unauthorized')({
  component: () => (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-neutral-500">You don't have access to this page.</p>
    </main>
  ),
})
