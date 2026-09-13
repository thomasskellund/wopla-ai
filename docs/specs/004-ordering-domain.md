# Domain 3: Ordering — specification

Source of truth is the **legacy app only** (`wopla-combined/wopla-backend` +
`wopla-combined/wopla-frontend`) — the `wopla/` rewrite was not consulted,
same as chat. This is the single most complex domain in the platform: full
legacy research is 34 numbered findings across schema, the recompute engine,
cutoff/grace-period math, and ~24 async messages. This document scopes a
first pass, proposes the wopla-ai equivalent, and calls out every place the
proposal deviates from legacy and why.

## 0. Why this pass is scoped down

Legacy's ordering surface covers 9 order "modules" (Lunch, Meeting, Fruit,
Guest, Kiosk, Special, Bakery, Home, Coffee), full commercial contracts
(pricing, kickback %, delivery terms, switch-requests), ratings, print
lists/bulk email reports, and a dedicated admin business-rules UI. Building
all of it in one pass would repeat the mistake this whole process exists to
avoid — a huge surface shipped without the workflow ever being walked
end-to-end. This pass ships **Lunch (module 1) only** — the actual daily
grind of the product — with the engine designed generally enough that
adding the other modules later is a data/config change, not a rearchitecture
(see §9).

## 1. What legacy actually does (condensed)

**Two layers.** A **standing order** (`order` + `order_detail`) is a
contract-like template: company + vendor + module + a validity window, with
either (a) admin-typed head counts per dish per weekday, or (b) counts
*derived* by tallying employee preferences — the mode switch is
`company.admin_managed_order`. A **daily order** (`daily_order` +
`daily_order_detail`) is a materialized per-date snapshot, lazily created
the first time anything touches that date, plus per-employee one-off
overrides (`order_preferences` / `daily_order_preferences` in our naming) —
**presence of an override row means "deviates from the standing weekly
choice"; absence means "follow the standing choice for that weekday."**

**Dish `0` is a sentinel** for "no lunch / cancelled that day" in legacy —
not a real dish, a magic ID. We replace this with a genuine `NULL` (§4).

**Cutoffs (grace periods)** are the trickiest part, and legacy's algorithm
is worth reproducing faithfully — it's a real, load-bearing business rule,
not incidental complexity:
- **Minor update** (day-level tweak): walk backward from the order's own
  date, `minor_update` *working* days, skipping general (public) holidays
  entirely and *counting* company-specific holidays, landing at a cutoff
  time. Now vs. cutoff decides editability.
- **Major update** (a change big enough to trip `threshold`, or a
  cancellation unless `cancel_grace_period` says cancellation follows the
  minor rule instead): same backward walk, but anchored at the **Monday of
  the order's week** for Lunch specifically, not the order date itself.
- **Fruit** has its own Thursday-anchored weekly variant — out of scope
  this pass (Fruit isn't Lunch), noted for when that module is added.
- `ROLE_ADMIN` bypasses every cutoff check, on purpose (an admin can always
  intervene) — worth keeping.

**Locking**: once a date's own cutoff has passed, its daily order flips to
`locked` and its `employee_share`/`minimum_heads`/`working_day` get
snapshotted (invoicing depends on these later, once billing exists).

## 2. The most important legacy bug, and why it explains a lot

**Locking is driven by today's clock, not the order date's own cutoff.**
Legacy's `checkMinorUpdateTime()` compares *right now* against *today* at
the cutoff time and is called from `getOrSaveDailyOrder()` — which runs on
read paths too. Once today's cutoff time passes, **any daily order
materialized for the rest of that session — including next month's —
gets created already `locked`.** This is almost certainly why entire future
weeks can show as locked in legacy for no visible reason. **This is the one
bug from the research we are most deliberate about fixing**: `engine.
get_or_create_daily_order` evaluates the cutoff against *that specific
date*, always.

Other bugs found and **not** reproduced (full list in the research; the
headline ones):
- GraphQL authorization is disabled the same way chat's was (`return true;
  //only for demo`) — any authenticated user can call any mutation,
  including cancelling another company's order. Not reproduced; RLS +
  membership-checked RPCs throughout, same pattern as auth/chat.
- A `||` that should be `&&` in offboarding logic force-cancels daily
  orders that are already locked or cancelled, wiping their cancellation
  metadata.
- The threshold that decides "minor vs. major" is hardcoded to always read
  from the **Lunch** module's grace period, even when editing a different
  module. We read it from the module actually being edited.
- No unique constraint exists on `(order_id, order_date)` for daily orders,
  so duplicate rows are possible and the code has explicit
  duplicate-handling scattered around it. We add the constraint.
- Two near-duplicate copies of the "is this dish checked / cancelled"
  logic exist, one with an active-employee guard and one without, and
  different call sites pick different ones depending on which trait they
  happen to `use`. One canonical implementation this time.
- A single holiday-exclusion row for a company can suppress *every* general
  holiday on that date for that company (an accidental `return []` for any
  match, not just the matched holiday). Exclusions are modeled per-holiday
  here, not per-date-blanket.
- Read queries (`getOrSaveDailyOrder`, grace-period auto-cloning) mutate
  and persist entity state as a side effect of a read, including flushing
  the whole unit of work. Nothing in our design writes on a read path;
  materialization happens through `api.*` RPCs only, same convention as
  every other domain.

## 3. Scope for this pass

**In scope** (Lunch/module 1 only):
- Standing weekly order (per-dish, per-weekday head counts), both
  admin-managed and employee-managed modes
- Employee's standing weekly dish choice
- Daily materialization + one-off daily override, with the fixed
  per-date locking
- Cutoff/grace-period engine (minor/major/threshold/cancellation),
  calendar (working days, public holidays, company holidays, employee
  absence)
- Cancel / un-cancel a daily order
- Vendor's daily/weekly headcount view
- Vendor-recorded ad-hoc "extra heads" adjustment with audit trail
- A minimal `dishes` table (a vendor's own dish list) — just enough to
  make ordering functional, not a menu-management domain
- Admin or company_admin creating the standing order itself (the
  company↔vendor↔module link with a date range) — minimal fields, no
  commercial contract terms

**Explicitly out of scope, deferred** (tracked on the Backlog artifact):
- The other 8 modules (Meeting, Fruit, Guest, Kiosk, Special, Bakery, Home,
  Coffee) — same engine, different config, added later
- Commercial contracts (pricing, kickback %, delivery terms,
  switch-requests) — a future contracts/billing domain
- Order ratings, print lists, bulk email reports
- A dedicated admin "business rules" settings UI — grace periods/working
  days/holidays get seeded with sensible defaults this pass; a settings
  screen to edit them is a follow-up
- Notifications (vendor daily summary email, rating requests) — legacy
  itself has **no** "remember to order" reminder to employees, so nothing
  is lost by deferring vendor-side email too
- Employee offboarding/reassignment order-cancellation logic

## 4. Proposed data model

```sql
-- Reference: legacy's numeric module IDs, preserved verbatim (historical
-- data/reporting references them; renumbering would break future migration).
-- Only id 1 (Lunch) is wired up with real behavior this pass.
create table public.modules (
  id smallint primary key,
  name text not null,
  slug text not null unique
);
-- seeded: (1,'Lunch','lunch'), (2,'Meeting','meeting'), (3,'Fruit','fruit'),
-- (4,'Guest','guest'), (5,'Kiosk','kiosk'), (14,'Special','special'),
-- (15,'Bakery','bakery'), (17,'Home','home'), (18,'Coffee','coffee')

create type public.weekday as enum ('mon','tue','wed','thu','fri','sat','sun');

-- Minimal dish catalogue — a vendor's own dishes. No pricing/categories/
-- images; that's a future menu-management domain's job.
create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id),
  name text not null,
  status public.entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- The standing weekly order: company + vendor + module + validity window.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  vendor_id uuid not null references public.vendors (id),
  module_id smallint not null references public.modules (id) default 1,
  from_date date not null,
  to_date date,                      -- null = open-ended
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
-- FIX vs legacy: legacy allows overlapping orders for the same
-- company+vendor+module with only loose app-level checks. For Lunch this
-- pass, an exclusion constraint prevents genuinely overlapping standing
-- orders outright (via btree_gist on company_id, vendor_id, module_id and
-- a daterange(from_date, to_date)).

-- Standing weekly heads per dish, normalized instead of legacy's 7 nullable
-- weekday columns repeated across 3 different tables.
create table public.order_dish_heads (
  order_id uuid not null references public.orders (id) on delete cascade,
  dish_id uuid not null references public.dishes (id),
  weekday public.weekday not null,
  heads int not null default 0,
  primary key (order_id, dish_id, weekday)
);

-- Employee's standing weekly dish choice (employee-managed mode only).
-- FIX vs legacy: dish_id NULL means "no lunch that day" — a real NULL,
-- not legacy's sentinel "dish row with id = 0".
create table public.user_dish_preferences (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  weekday public.weekday not null,
  dish_id uuid references public.dishes (id),
  updated_at timestamptz not null default now(),
  unique (order_id, profile_id, weekday)
);

-- Calendar: per-company working days. No row = Mon-Fri default (assumed in
-- the engine function, not materialized as a "global default" row the way
-- legacy does — avoids legacy's read-path-writes bug entirely).
create table public.company_working_days (
  company_id uuid primary key references public.companies (id) on delete cascade,
  mon boolean not null default true, tue boolean not null default true,
  wed boolean not null default true, thu boolean not null default true,
  fri boolean not null default true, sat boolean not null default false,
  sun boolean not null default false
);

create table public.public_holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  holiday_date date not null,
  module_id smallint references public.modules (id) -- null = all modules
);

-- FIX vs legacy: an exclusion is scoped to the specific holiday it
-- overrides, not "this company, this date" (which suppressed every
-- holiday sharing that date).
create table public.public_holiday_exclusions (
  holiday_id uuid not null references public.public_holidays (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  primary key (holiday_id, company_id)
);

create table public.company_holidays (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  module_id smallint references public.modules (id),
  holiday_date date not null
);

create table public.employee_absences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  absence_date date not null
);

-- Cutoff configuration. company_id NULL = global default (a real row this
-- time — reading a missing config is fine to fall back in SQL, but the
-- *default itself* isn't auto-cloned/persisted the way legacy's is).
create table public.grace_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  module_id smallint not null references public.modules (id),
  major_update_days int not null default 5,
  major_update_time time not null default '10:00',
  minor_update_days int not null default 1,
  minor_update_time time not null default '10:00',
  cancellation_days int not null default 1,
  cancellation_time time not null default '10:00',
  cancel_grace_period boolean not null default false, -- true: cancellation follows the minor rule
  threshold int not null default 0,
  unique (company_id, module_id)
);

create type public.daily_order_status as enum ('active', 'locked', 'cancelled');

-- FIX vs legacy: unique(order_id, order_date) — legacy has no such
-- constraint and ends up with defensive duplicate-handling code instead.
create table public.daily_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  company_id uuid not null references public.companies (id),
  vendor_id uuid not null references public.vendors (id),
  order_date date not null,
  status public.daily_order_status not null default 'active',
  total_heads int not null default 0,
  minimum_heads int,           -- snapshot at lock time
  employee_share numeric,      -- snapshot at lock time
  was_working_day boolean,     -- snapshot at lock time
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id),
  cancellation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, order_date)
);
create index daily_orders_lookup_idx on public.daily_orders (order_id, order_date, company_id, vendor_id);
create index daily_orders_date_idx on public.daily_orders (order_date);

create table public.daily_order_dish_heads (
  daily_order_id uuid not null references public.daily_orders (id) on delete cascade,
  dish_id uuid not null references public.dishes (id),
  heads int not null default 0,
  primary key (daily_order_id, dish_id)
);

-- Employee's one-off override for one date. Presence = deviation from the
-- standing weekly choice (same semantics as legacy's order_preferences).
create table public.daily_order_preferences (
  id uuid primary key default gen_random_uuid(),
  daily_order_id uuid not null references public.daily_orders (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  dish_id uuid references public.dishes (id), -- null = cancel for that date
  updated_at timestamptz not null default now(),
  unique (daily_order_id, profile_id)
);

-- Vendor-recorded ad-hoc adjustment (phone/WhatsApp orders), audit trail.
-- Baked into daily_order_dish_heads immediately, same as legacy.
create table public.daily_order_events (
  id uuid primary key default gen_random_uuid(),
  daily_order_id uuid not null references public.daily_orders (id) on delete cascade,
  dish_id uuid not null references public.dishes (id),
  original_heads int not null,
  extra_heads int not null,
  note text,
  added_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
```

Note: `companies.admin_managed_order` already exists from domain 1's
identity migration — this domain reads it, doesn't redefine it.

## 5. The engine (`engine` schema — new for this domain)

First domain that actually needs computation, so this introduces the
`engine` schema described in this project's architecture as the home for
internal, `security definer`, no-grants business logic:

- `engine.is_working_day(company_id, date) returns boolean`
- `engine.holiday_type(company_id, profile_id, module_id, date) returns text`
  — `'general' | 'company' | 'employee' | null`, checked in that order,
  exclusions resolved per-holiday (§4 fix)
- `engine.grace_period(company_id, module_id) returns public.grace_periods`
  — company-specific row, falling back to the `company_id is null` default
  row, computed at read time, nothing written
- `engine.can_make_minor_update(company_id, module_id, order_date) returns boolean`
  — the backward-walk algorithm from §1, **evaluated against `order_date`
  every time** (the §2 fix)
- `engine.can_make_major_update(company_id, module_id, order_date, is_cancellation boolean default false) returns boolean`
  — week-Monday-anchored for Lunch; if `is_cancellation` and the grace
  period's `cancel_grace_period` is true, delegates to the minor check
- `engine.classify_update(order_id, order_date, proposed_heads) returns table (is_minor boolean, delta int)`
  — threshold read from the order's own module (§2 fix, not hardcoded to
  Lunch)
- `engine.get_or_create_daily_order(order_id, order_date) returns public.daily_orders`
  — materializes on demand; sets `status = 'locked'` only when
  `can_make_minor_update` says *this date* has passed its own cutoff, and
  snapshots the invoicing fields at that moment
- `engine.recompute_standing_heads(order_id, weekday)` — Lunch,
  employee-managed only: recounts `user_dish_preferences` into
  `order_dish_heads` for that weekday
- `engine.recompute_daily_heads(daily_order_id)` — recounts
  `daily_order_preferences` (falling back to the standing weekly choice
  where no override exists) into `daily_order_dish_heads`

No async message queue: legacy's ~24 Messenger message classes exist
because recompute happens in an application server. Here the database *is*
the backend — the same computation runs as a plain trigger/function call
inside the same transaction as the write that caused it (a preference
change immediately recomputes its own weekday; a standing-order edit
immediately recomputes affected future daily orders that are still
`active`). A daily `pg_cron` job (`engine-roll-orders`) pre-materializes
the next N days so the vendor's headcount view doesn't wait on the first
employee to touch a date — parity with legacy's daily job, without its
locking bug.

## 6. API surface (`api` schema RPCs)

| RPC | Purpose |
|---|---|
| `api.create_order(company_id, vendor_id, from_date, to_date)` | Bootstraps the standing order — the company↔vendor↔Lunch link. Nothing else in ordering works before this exists (see §7's live-testing note). Admin or company_admin only. |
| `api.save_order_dish_heads(order_id, dish_id, weekday_heads jsonb)` | Admin-managed mode: set the standing weekly heads for one dish. |
| `api.set_my_weekly_preference(order_id, weekday, dish_id)` | Employee-managed mode: employee's standing weekly choice; `dish_id null` = no lunch that day. Triggers `engine.recompute_standing_heads`. |
| `api.get_my_week(order_id, week_start)` | Employee's view: this week's dates, each date's dish (override if present, else standing), and editability per date. |
| `api.set_my_daily_choice(order_id, order_date, dish_id)` | Employee's one-off override for one date. Validated via `engine.can_make_minor_update`; deletes the override row if it now matches the standing choice (matches legacy's "override absent = follow standard" semantics). |
| `api.cancel_daily_order(order_id, order_date, note)` / `api.uncancel_daily_order(...)` | Validated via `engine.can_make_major_update(..., is_cancellation => true)`, admin bypasses. |
| `api.get_vendor_headcount(vendor_id, order_date)` | Vendor's per-company per-dish breakdown for one date, across all their standing orders. |
| `api.record_extra_heads(daily_order_id, dish_id, extra_heads, note)` | Vendor-recorded ad-hoc adjustment; bakes into `daily_order_dish_heads`, logs to `daily_order_events`. |

## 7. Workflows (drawn from the legacy code research; live legacy walkthrough was blocked — see below)

- **Bootstrap** (admin or company_admin): create the standing order linking
  a company, a vendor, and a start date. *Nothing else in ordering is
  reachable before this exists* — confirmed directly: every demo company on
  the live legacy reference has no active order, and its employee/company
  ordering screens all show "no active order" rather than any grid at all.
  This will be the first thing verified once implemented, not an
  afterthought.
- **Employee, employee-managed company**: sets a standing Monday-choice
  once; from then on just corrects individual days when needed (a
  meeting runs long, working from home that day). Attempting to change a
  day after its own cutoff shows a clear "grace period expired" message,
  not a silent failure.
- **Company admin, admin-managed company**: types head counts directly
  per dish per weekday for the whole company; employees have no ordering
  UI at all in this mode.
- **Vendor**: opens today's headcount, sees it broken down by company and
  dish; gets a phone call for 3 extra portions, records it as an
  adjustment with a note, sees the running total update immediately.
- **Cancellation**: a company admin cancels a date (e.g. office closed);
  legacy propagates that to every employee's daily choice for Lunch. We
  reproduce that propagation.

**Live legacy walkthrough was significantly more constrained than chat's
was** — worth recording since it's a second data point for the standing
process: every company on the reference deployment has no active
order/contract at all (not just "no orders this week"), and three
unrelated pages errored outright during this pass (a vendor list, a
company's contract-details tab, and the company_admin order-creation
form itself — a generic error screen, not emptiness). This domain's spec
leans on the code research much more heavily than chat's did; live
observation here mostly confirmed *structure* (what tabs/fields exist)
rather than actual populated behavior. Once wopla-ai's own version exists,
the completion-gate walkthrough (§ standing process) will be the first
time this workflow is actually observable end-to-end anywhere, legacy
included.

## 8. Decisions (resolved 2026-09-13)

1. **Scope confirmation** — confirmed: the §3 cut stands as written
   (Lunch only, no contracts/ratings/other-modules).
2. **`admin_managed_order` toggle** — **admin-only**. Treated like a
   business-relationship setting, same tier as creating the vendor link
   itself. `api` RPCs that flip this must check `app.is_admin()`, not just
   company-scoped access; company_admin can *see* the mode but has no RPC
   path to change it.
3. **Grace-period defaults for demo/seed data** — the proposed defaults are
   confirmed as-is: minor cutoff 1 working day before at 10:00; major
   cutoff (and cancellation, since `cancel_grace_period` follows the major
   rule by default) 5 working days before at 10:00, Monday-anchored;
   threshold 5.
4. **Overlap constraint** — confirmed: **add** a DB-level exclusion/check
   constraint preventing two overlapping standing Lunch orders for the
   same company+vendor. No deliberate-overlap use case is needed; this is
   a real integrity improvement over legacy, not a divergence to flag
   during workflow-parity testing.
