# Virksomheder workflow-parity retrospective

Unlike invoicing, legacy genuinely has a live 11-tab frontend for this
domain — but this retro is still wopla-ai-vs-itself, since the research
process (not a live legacy walkthrough) is what shaped this pass's scope,
and the point now is confirming the *implementation* holds up.

## Method

Ran the dev server against a freshly reset local DB. Walked the full admin
flow (create an employee account, deactivate/reactivate, working days,
holidays at all three levels, grace period), then confirmed company_admin
self-service and vendor_admin's narrower view.

## What was tested and confirmed working

- **Employee creation via the new Edge Function**: created "Nina Newhire"
  for CompanyA from the live UI — a real `auth.users` row plus a `profiles`
  row got created, and the generated password was returned and displayed
  exactly once, matching the confirmed decision (legacy's pattern, no
  auto-email).
- **The claims-enforcement fix, verified at the database level, not just
  through the UI**: deactivating Nina correctly nulled both
  `wopla_role` and `company_id` in her `auth.users.raw_app_meta_data` —
  confirmed directly via SQL, not just by the UI showing "inactive." This
  was the one part of this domain that could have silently done nothing
  (a trigger that never fires looks identical to one that fires and no-ops)
  had it not been checked this way.
- **Working days**: saved Sat=true for CompanyA, confirmed via direct SQL
  that the upsert wrote the exact row expected.
- **Holidays, all three levels in one tab**: company closures, per-
  employee absences (via a live employee picker sourced from the same
  company), and the global public-holiday calendar (correctly showing the
  two Danish holidays the ordering domain seeded) — all rendered and
  wrote correctly, and the public-holidays section correctly only appears
  for admin.
- **Grace period**: confirmed the form initially shows generic UI defaults
  (not yet-fetched data) when no company-specific row exists, then
  verified via direct SQL that saving actually created a real
  company-scoped override row, not just an in-memory change.
- **Self-service, live**: logged in as Cecilie (CompanyA's company_admin)
  and confirmed she lands directly on her own company's settings (no
  company list, no create-company affordance, no "Vendors" nav link at
  all) — matching the confirmed decision to preserve legacy's actual
  permission split.
- **Vendor CRUD + staff**: confirmed Grøn Kantine's General tab loads real
  seed data, and its Staff tab correctly omits the role picker entirely
  (only `vendor_admin` is creatable there, so there's nothing to choose).

## A real deployment-process bug found (not a code bug)

The Edge Function returned a generic "non-2xx status code" error on first
use, which traced to a 404 — **the local `edge_runtime` container doesn't
discover a newly-added function directory on its own**; it needed an
explicit `supabase stop && supabase start` before the new
`create-employee` function was served at all, even though no config
changes were needed for it to work afterward. Worth remembering for the
devserver-1 deploy of this domain too, and for any future domain that
adds its first (or another) Edge Function.

## Conclusion

No legacy UI comparison was the point this time (the research already did
that thoroughly) — this retro is confirmation the scoped-down
implementation is actually correct, plus the one process gotcha
(Edge Function discovery needing a restart) worth remembering for next time.
