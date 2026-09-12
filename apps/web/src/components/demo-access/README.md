# Demo access (remove before production)

Convenience-only login helpers for letting test users poke at a demo
deployment without needing real credentials. Not a security boundary — the
site-gate password is a shared static string shipped to every client.

Two integration points, both easy to spot and revert:

- `apps/web/src/routes/__root.tsx` wraps `<Outlet />` in `<DemoGate>`.
- `apps/web/src/routes/login.tsx` renders `<QuickLoginButtons>` below the
  real login form.

**To remove before shipping to production:**

1. Delete this whole `demo-access/` folder.
2. In `__root.tsx`, remove the `DemoGate` import and unwrap `<Outlet />`.
3. In `login.tsx`, remove the `QuickLoginButtons` import and its usage.
