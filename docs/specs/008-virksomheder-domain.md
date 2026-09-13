# Domain 5: Virksomheder (company/vendor/employee management) — specification

Source of truth is the **legacy app only** (`wopla-combined/wopla-backend` +
`wopla-combined/wopla-frontend`) — the `wopla/` rewrite was not consulted,
same standing constraint as every prior domain. Full research report on
file; this document scopes a deliberately narrow first pass out of legacy's
much larger 11-tab surface.

## 0. Why this pass is scoped down

Legacy's "Virksomheder" is the single largest surface researched so far:
company CRUD, vendor CRUD, employee CRUD (with CSV bulk import and a
credentials modal), working days, holidays, grace periods, per-module
access grants, a per-weekday dish-restriction feature with its own
cutoff-aware migration workflow, and a vendor-relationship tab that
duplicates data the ordering domain already models. Building all of it
now would repeat exactly the mistake this whole process exists to avoid.
This pass ships **core CRUD + the settings screens the ordering domain
already deferred** — nothing else.

Also worth noting up front: legacy's actual data model here (a single
polymorphic `User` entity with a role, a parent/child tree, and a
many-to-many company↔employee binding table) is **messier** than
wopla-ai's existing `companies`/`vendors`/`profiles` split, not something
this domain needs to "catch up" to. Most of what legacy calls
company/vendor "creation" is really just populating a thin 1:1 detail row
on top of that `User` — the equivalent tables (`companies`, `vendors`,
`profiles`) already exist in wopla-ai from domain 1. **This domain adds
almost no new schema** — it's mostly the missing write-paths (RPCs +
one Edge Function) and frontend for tables that have existed since day one.

## 1. What legacy actually does (condensed)

Every company/vendor/employee create-or-edit funnels through one GraphQL
mutation (`createUser`) that branches on role. Company and vendor creation
**unconditionally emails a randomly-generated password immediately** on
creation (`sendWelcomeEmailCompany()`), with no draft/staging step.
Employee/company_admin creation is different: **no automatic email at
all** — the code path is explicitly commented out — and instead an admin
either generates a plaintext temporary password on demand (shown once in
a modal, "login using these credentials from Incognito mode") or manually
triggers a separate `sendWelcomeEmail` mutation. **Decision (confirmed):
match legacy's pattern** — admin-generated temporary password shown once,
no automatic email.

There is **no admin UI to activate/deactivate a top-level company or
vendor** in legacy — only hard delete, blocked while the company/vendor
has any orders. Employees/company_admins, by contrast, have a real
status lifecycle (`active_from`/`active_to` dates plus a manual toggle).

Working days, holidays (public + per-employee absence), and grace periods
are genuinely self-serviceable by `company_client_admin` for their own
company in legacy, via a parallel route tree reusing the exact same
components as the admin view. **Decision (confirmed): preserve this** —
company_admin can self-serve these for their own company; admin can for
any company.

## 2. Legacy bugs and features deliberately not carried forward

- **Authorization is fully disabled** (`CustomGraphQLVoter::
  voteOnAttribute()` returning `true` unconditionally) — same bug found in
  every prior domain; not reproduced, RLS + role-checked writes throughout.
- **A confirmed offboarding bug** — deleting an employee force-cancels
  every future daily order via a tautological condition (`status != A ||
  status != B`, always true when `A ≠ B`), wiping locked/already-cancelled
  orders' metadata (`OrderReassignmentService.php:112-123`). **Decision
  (confirmed): deferred, not fixed this pass** — this pass's employee
  "removal" is a soft deactivation only (see §3); the whole
  cancel-future-orders-on-offboarding *feature* doesn't ship yet, so
  there's no buggy code path to trigger. Tracked on the Backlog for
  whenever offboarding-with-cascade is actually built.
- **"Tilknyttede leverandører" (associated vendors)** — the tab confirmed
  broken live in earlier research — turns out to duplicate a different,
  working tab that sources the same `orders` data more simply. **Not
  reproduced**: nothing is lost, since the same information (which
  vendors a company currently orders from) is trivially derivable from
  `orders` directly if ever wanted.
- **"Giv adgang" (per-module order access grants)** — every module past
  Lunch is grantable in legacy, but no second module exists in wopla-ai's
  ordering domain yet. **Deferred entirely** — nothing to grant access to.
- **"Begræns retter" (restrict dishes)** — legacy's version is a real
  cutoff-aware migration (reassigning already-placed orders off a
  newly-restricted dish, per §7 of the research). **Deferred entirely**
  this pass, not even a simplified version — tracked on the Backlog.
- **Payroll/accounting integration fields** (`CompanySalaryFields`,
  Danløn/Dataløn/IntegaLøn/Zenegy), **automated report scheduling**
  (`report_start_day`/`report_end_day`/`report_emails`), and **multi-branch
  company hierarchy + multi-company employee bindings** (`parent_company`/
  `UserBinding`) — all real legacy features, all deferred (Backlog).
  wopla-ai's `companies`/`profiles` stay single-company, no hierarchy.
- **Grace period's `rating`/`rating_time` fields** — exist in legacy's
  settings UI but have no equivalent in wopla-ai's `grace_periods` table
  (belongs to a not-yet-built Ratings domain). Not added this pass.

## 3. Scope for this pass

**In scope**:
- **Company CRUD**: admin creates; company_admin/admin edit the company's
  own "Generel" info. (The RLS for this already exists from domain 1 —
  `companies_admin` is `for all`, `companies_own_update` already lets
  company_admin edit their own row — this pass is mostly the *frontend*
  for what the database already permits.)
- **Vendor CRUD**: same shape, admin creates, vendor_admin/admin edit
  (again, RLS already exists from domain 1).
- **Employee CRUD**: admin or company_admin creates an employee for a
  company (or another company_admin) via a new Edge Function (creating
  the actual login-capable account is the one thing no RPC can do —
  needs the Auth Admin API). Edit basic fields (name/phone/language) —
  already permitted by existing domain-1 RLS, no new RPC needed.
  Deactivate/reactivate (`profiles.status`) — same, already permitted by
  existing RLS; this pass wires the claims-sync trigger to actually
  *enforce* deactivation (see §5), which domain 1 defined but never
  enforced.
- **Working days, holidays (public + employee absences), grace periods**:
  new RPCs (these tables were deliberately left read-only by the ordering
  domain, "pending a future settings screen" — this is that screen),
  self-serviceable by company_admin for their own company, by admin for
  any company. Public holidays (the shared calendar, not company-scoped)
  are admin-only.

**Explicitly out of scope, deferred** (Backlog): grant-access, restrict-
dishes (+ its migration workflow), the associated-vendors tab, payroll/
accounting fields, report scheduling, multi-branch hierarchy, the
offboarding cancel-cascade feature, rating/rating_time grace-period
fields, vendor delivery zones/module participation/thresholds/CSV
integration toggles (vendor CRUD this pass is the same base fields
`companies`/`vendors` already share — name/address/city/zip/vat/status).

## 4. Data model — almost none needed

No new tables. `companies`, `vendors`, `profiles`, `company_working_days`,
`public_holidays`, `public_holiday_exclusions`, `company_holidays`,
`employee_absences`, `grace_periods` all already exist (domains 1 and 3).
This domain is the missing write-paths + frontend for tables that have
existed since day one.

**One small but real fix**: `app.sync_profile_claims()` (domain 1) syncs
role/company_id/vendor_id into the JWT but never considered `status` —
so a deactivated employee's claims were never actually revoked, meaning
`profiles.status = 'inactive'` was pure decoration with nothing enforcing
it anywhere. This pass updates that trigger to null out the claims when
status isn't `active`, so a deactivated user matches no RLS policy on
their next token refresh — using the *exact* mechanism domain 1's own
identity migration already documented ("a user with no wopla_role claim
matches no policy and is treated as unauthorised"), not a new mechanism.

## 5. New Edge Function: `create-employee`

The one thing genuinely impossible from a plain RPC: creating an actual
login-capable `auth.users` row requires the service-role Auth Admin API,
not available to `security definer` Postgres functions. Deno, service-role
keyed, same conventions as the project's other Edge Functions (CORS
preamble, hand-verifies the caller's JWT and role):

- Verifies caller is `admin`, or `company_admin` creating for their own
  `company_id`.
- Generates a random password (matching legacy's pattern, confirmed §1),
  calls `auth.admin.createUser({ email, password, email_confirm: true })`.
- Inserts the `profiles` row (fires the existing `sync_profile_claims`
  trigger automatically).
- Returns `{ email, password }` once, for the caller to display — no
  email is sent, matching the confirmed decision.

## 6. API surface (`api` schema RPCs)

| RPC | Purpose |
|---|---|
| `api.set_company_working_days(company_id, mon..sun)` | Upsert. Admin or company_admin (own company). |
| `api.create_public_holiday(name, holiday_date, module_id default null)` / `api.delete_public_holiday(id)` | Admin-only — the shared calendar, not company-scoped. |
| `api.create_company_holiday(company_id, holiday_date, module_id default null)` / `api.delete_company_holiday(id)` | Admin or company_admin (own company). |
| `api.create_employee_absence(profile_id, absence_date)` / `api.delete_employee_absence(id)` | Admin, or company_admin for their own company's employee. |
| `api.set_grace_period(company_id, module_id, minor_update_days, minor_update_time, major_update_days, major_update_time, cancellation_days, cancellation_time, cancel_grace_period, threshold)` | Upsert on `(company_id, module_id)`. Admin or company_admin (own company). |

Company/vendor/employee create-and-edit deliberately have **no** new
RPCs — the existing domain-1 RLS (`for all` for admin, `_own_update` for
company_admin/vendor_admin, `profiles_company_admin_all`) already permits
exactly the right writes directly; adding a wrapping RPC would just
duplicate what the database already enforces.

## 7. Decisions (resolved 2026-09-14)

1. **Scope** — confirmed: core CRUD + the deferred settings screens only;
   grant-access, restrict-dishes, associated-vendors, payroll/report
   fields, and multi-branch hierarchy all deferred.
2. **Employee onboarding** — confirmed: match legacy's pattern (admin-
   generated temporary password shown once, no automatic email).
3. **Self-service** — confirmed: company_admin can self-serve their own
   company's working-days/holidays/grace-period; admin can for any.
4. **Offboarding bug** — confirmed: deferred, not fixed this pass, since
   the cascade feature it lives in isn't being built this pass either.
