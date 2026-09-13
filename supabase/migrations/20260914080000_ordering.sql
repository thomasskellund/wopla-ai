-- Domain: ordering — 0001 Schema
-- See docs/specs/004-ordering-domain.md for the full spec this implements.
-- Lunch (module 1) only this pass; the engine is generic across modules.

-- ------------------------------------------------------------- companies
-- admin_managed_order does NOT already exist (the spec's note that domain
-- 1 added it was wrong — verified against the actual identity migration).
-- Decision (spec §8.2): admin-only to flip; company_admin can see it but
-- has no write path, enforced below with a column-protection trigger the
-- same shape as app.protect_profile_columns.
alter table public.companies add column admin_managed_order boolean not null default false;

create or replace function app.protect_company_admin_managed_order()
returns trigger
language plpgsql
as $$
begin
  if app.is_admin() or (select auth.uid()) is null then
    return new;
  end if;
  if new.admin_managed_order is distinct from old.admin_managed_order then
    raise exception 'only admin can change admin_managed_order';
  end if;
  return new;
end;
$$;
create trigger protect_company_admin_managed_order
before update on public.companies
for each row execute function app.protect_company_admin_managed_order();

-- --------------------------------------------------------------- modules
-- Legacy's numeric module IDs, preserved verbatim — historical data and
-- future migration/reporting reference them; never renumber. Only Lunch
-- (1) has real behavior wired up this pass; the rest exist so the engine's
-- module_id foreign keys and the eventual "add a module" story don't need
-- a later renumbering migration.
create table public.modules (
  id smallint primary key,
  name text not null,
  slug text not null unique
);
insert into public.modules (id, name, slug) values
  (1, 'Lunch', 'lunch'),
  (2, 'Meeting', 'meeting'),
  (3, 'Fruit', 'fruit'),
  (4, 'Guest', 'guest'),
  (5, 'Kiosk', 'kiosk'),
  (14, 'Special', 'special'),
  (15, 'Bakery', 'bakery'),
  (17, 'Home', 'home'),
  (18, 'Coffee', 'coffee');

create type public.weekday as enum ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');

-- ---------------------------------------------------------------- dishes
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
select app.add_updated_at('public.dishes');
create index dishes_vendor_idx on public.dishes (vendor_id) where deleted_at is null;

-- ---------------------------------------------------------------- orders
-- The standing weekly order: company + vendor + module + validity window.
create extension if not exists btree_gist;

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
  deleted_at timestamptz,
  constraint orders_date_range_valid check (to_date is null or to_date >= from_date)
);
select app.add_updated_at('public.orders');
create index orders_company_idx on public.orders (company_id) where deleted_at is null;
create index orders_vendor_idx on public.orders (vendor_id) where deleted_at is null;

-- FIX vs legacy: legacy allows overlapping standing orders for the same
-- company+vendor+module with only loose app-level checks (spec §8.4,
-- confirmed: add this). A soft-deleted order (deleted_at is not null)
-- doesn't count toward the exclusion.
alter table public.orders add constraint orders_no_overlap
  exclude using gist (
    company_id with =,
    vendor_id with =,
    module_id with =,
    daterange(from_date, coalesce(to_date, 'infinity'::date), '[]') with &&
  ) where (deleted_at is null);

-- A vendor can see the companies it currently serves (promised by a comment
-- left on domain 1's identity migration when this table didn't exist yet).
create policy companies_vendor_client_read on public.companies for select to authenticated
  using (
    app.role() = 'vendor_admin' and deleted_at is null and exists (
      select 1 from public.orders o
      where o.company_id = companies.id and o.vendor_id = app.vendor_id() and o.deleted_at is null
    )
  );

-- Symmetric: company_admin/employee can see a vendor they currently have a
-- standing order with (name/address, not vendor-internal data).
create policy vendors_client_read on public.vendors for select to authenticated
  using (
    app.role() in ('company_admin', 'employee') and deleted_at is null and exists (
      select 1 from public.orders o
      where o.vendor_id = vendors.id and o.company_id = app.company_id() and o.deleted_at is null
    )
  );

-- Standing weekly heads per dish, normalized instead of legacy's 7 nullable
-- weekday columns repeated across 3 different tables.
create table public.order_dish_heads (
  order_id uuid not null references public.orders (id) on delete cascade,
  dish_id uuid not null references public.dishes (id),
  weekday public.weekday not null,
  heads int not null default 0 check (heads >= 0),
  primary key (order_id, dish_id, weekday)
);

-- Employee's standing weekly dish choice (employee-managed mode only).
-- FIX vs legacy: dish_id NULL means "no lunch that day" — a real NULL, not
-- legacy's sentinel "dish row with id = 0".
create table public.user_dish_preferences (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  weekday public.weekday not null,
  dish_id uuid references public.dishes (id),
  updated_at timestamptz not null default now(),
  unique (order_id, profile_id, weekday)
);
select app.add_updated_at('public.user_dish_preferences');

-- ------------------------------------------------------------- calendar
-- Per-company working days. No row = Mon-Fri default (assumed in the
-- engine function, not materialized as a "global default" row the way
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
-- holiday sharing that date — spec §1).
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
create index company_holidays_lookup_idx on public.company_holidays (company_id, holiday_date);

create table public.employee_absences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  absence_date date not null
);
create index employee_absences_lookup_idx on public.employee_absences (profile_id, absence_date);

-- Cutoff configuration. company_id NULL = global default (a real row this
-- time — reading a missing config is fine to fall back to in SQL, but the
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

-- Global default (spec §8.3, confirmed as-is): minor 1 working day @10:00,
-- major 5 working days @10:00 (Monday-anchored for Lunch), threshold 5.
insert into public.grace_periods (company_id, module_id, major_update_days, major_update_time, minor_update_days, minor_update_time, threshold)
values (null, 1, 5, '10:00', 1, '10:00', 5);

-- A couple of real Danish public holidays covering the demo window, all
-- modules. Sensible defaults per spec §3 — not a full calendar.
insert into public.public_holidays (name, holiday_date, module_id) values
  ('Juledag', '2026-12-25', null),
  ('2. juledag', '2026-12-26', null);

-- ------------------------------------------------------------- daily orders
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
select app.add_updated_at('public.daily_orders');
create index daily_orders_lookup_idx on public.daily_orders (order_id, order_date, company_id, vendor_id);
create index daily_orders_date_idx on public.daily_orders (order_date);

create table public.daily_order_dish_heads (
  daily_order_id uuid not null references public.daily_orders (id) on delete cascade,
  dish_id uuid not null references public.dishes (id),
  heads int not null default 0 check (heads >= 0),
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
select app.add_updated_at('public.daily_order_preferences');

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
create index daily_order_events_lookup_idx on public.daily_order_events (daily_order_id);

-- ------------------------------------------------------------------- RLS
-- Every table gets SELECT-only policies (RLS is the floor); every write in
-- this domain goes through the api.* RPCs, same convention as chat.
alter table public.modules enable row level security;
alter table public.dishes enable row level security;
alter table public.orders enable row level security;
alter table public.order_dish_heads enable row level security;
alter table public.user_dish_preferences enable row level security;
alter table public.company_working_days enable row level security;
alter table public.public_holidays enable row level security;
alter table public.public_holiday_exclusions enable row level security;
alter table public.company_holidays enable row level security;
alter table public.employee_absences enable row level security;
alter table public.grace_periods enable row level security;
alter table public.daily_orders enable row level security;
alter table public.daily_order_dish_heads enable row level security;
alter table public.daily_order_preferences enable row level security;
alter table public.daily_order_events enable row level security;

-- modules / public_holidays: global reference data, readable by anyone
-- authenticated.
create policy modules_read on public.modules for select to authenticated using (true);
create policy public_holidays_read on public.public_holidays for select to authenticated using (true);

-- dishes: a vendor manages its own (through api.create_dish/set_dish_status
-- — SELECT-only here like every other table in this domain, no `for all`
-- bypass even for admin); a company can see the dishes of a vendor it
-- currently orders from (to render its ordering UI).
create policy dishes_admin on public.dishes for select to authenticated
  using (app.is_admin());
create policy dishes_vendor_own on public.dishes for select to authenticated
  using (app.role() = 'vendor_admin' and vendor_id = app.vendor_id());
create policy dishes_client_read on public.dishes for select to authenticated
  using (
    app.role() in ('company_admin', 'employee') and deleted_at is null and exists (
      select 1 from public.orders o
      where o.vendor_id = dishes.vendor_id and o.company_id = app.company_id() and o.deleted_at is null
    )
  );

-- orders: each side of the relationship sees its own; admin sees all.
create policy orders_admin on public.orders for select to authenticated
  using (app.is_admin());
create policy orders_company_read on public.orders for select to authenticated
  using (app.role() in ('company_admin', 'employee') and company_id = app.company_id());
create policy orders_vendor_read on public.orders for select to authenticated
  using (app.role() = 'vendor_admin' and vendor_id = app.vendor_id());

-- order_dish_heads: same tenancy as its parent order.
create policy order_dish_heads_read on public.order_dish_heads for select to authenticated
  using (
    exists (
      select 1 from public.orders o where o.id = order_dish_heads.order_id
        and (
          app.is_admin()
          or (app.role() in ('company_admin', 'employee') and o.company_id = app.company_id())
          or (app.role() = 'vendor_admin' and o.vendor_id = app.vendor_id())
        )
    )
  );

-- user_dish_preferences: an employee sees their own row; company_admin
-- sees every employee's row for its own company's orders (account
-- management); vendor does not see individual preferences, only the
-- aggregated heads (privacy — matches the aggregate-only view legacy gives
-- vendors).
create policy user_dish_preferences_self on public.user_dish_preferences for select to authenticated
  using (profile_id = (select auth.uid()));
create policy user_dish_preferences_company_admin on public.user_dish_preferences for select to authenticated
  using (
    app.role() = 'company_admin' and exists (
      select 1 from public.orders o where o.id = user_dish_preferences.order_id and o.company_id = app.company_id()
    )
  );
create policy user_dish_preferences_admin on public.user_dish_preferences for select to authenticated
  using (app.is_admin());

-- company_working_days / company_holidays / employee_absences / grace_periods:
-- readable by the owning company (+ admin). Vendors don't need these —
-- editability decisions are surfaced to them via the api.* RPCs instead.
create policy company_working_days_read on public.company_working_days for select to authenticated
  using (app.is_admin() or (app.role() in ('company_admin', 'employee') and company_id = app.company_id()));
create policy company_holidays_read on public.company_holidays for select to authenticated
  using (app.is_admin() or (app.role() in ('company_admin', 'employee') and company_id = app.company_id()));
create policy employee_absences_self on public.employee_absences for select to authenticated
  using (profile_id = (select auth.uid()));
create policy employee_absences_company_admin on public.employee_absences for select to authenticated
  using (
    app.role() = 'company_admin' and exists (
      select 1 from public.profiles p where p.id = employee_absences.profile_id and p.company_id = app.company_id()
    )
  );
create policy employee_absences_admin on public.employee_absences for select to authenticated
  using (app.is_admin());
create policy grace_periods_read on public.grace_periods for select to authenticated
  using (
    app.is_admin()
    or company_id is null -- the global default row is readable by everyone; it carries no tenant data
    or (app.role() in ('company_admin', 'employee') and company_id = app.company_id())
  );
create policy public_holiday_exclusions_read on public.public_holiday_exclusions for select to authenticated
  using (app.is_admin() or (app.role() in ('company_admin', 'employee') and company_id = app.company_id()));

-- daily_orders: company_id/vendor_id are stored directly, so no join needed.
create policy daily_orders_admin on public.daily_orders for select to authenticated
  using (app.is_admin());
create policy daily_orders_company_read on public.daily_orders for select to authenticated
  using (app.role() in ('company_admin', 'employee') and company_id = app.company_id());
create policy daily_orders_vendor_read on public.daily_orders for select to authenticated
  using (app.role() = 'vendor_admin' and vendor_id = app.vendor_id());

create policy daily_order_dish_heads_read on public.daily_order_dish_heads for select to authenticated
  using (
    exists (
      select 1 from public.daily_orders d where d.id = daily_order_dish_heads.daily_order_id
        and (
          app.is_admin()
          or (app.role() in ('company_admin', 'employee') and d.company_id = app.company_id())
          or (app.role() = 'vendor_admin' and d.vendor_id = app.vendor_id())
        )
    )
  );

create policy daily_order_preferences_self on public.daily_order_preferences for select to authenticated
  using (profile_id = (select auth.uid()));
create policy daily_order_preferences_company_admin on public.daily_order_preferences for select to authenticated
  using (
    app.role() = 'company_admin' and exists (
      select 1 from public.daily_orders d where d.id = daily_order_preferences.daily_order_id and d.company_id = app.company_id()
    )
  );
create policy daily_order_preferences_admin on public.daily_order_preferences for select to authenticated
  using (app.is_admin());

-- daily_order_events: audit trail visible to both sides of the
-- relationship it happened on, plus admin.
create policy daily_order_events_read on public.daily_order_events for select to authenticated
  using (
    exists (
      select 1 from public.daily_orders d where d.id = daily_order_events.daily_order_id
        and (
          app.is_admin()
          or (app.role() = 'company_admin' and d.company_id = app.company_id())
          or (app.role() = 'vendor_admin' and d.vendor_id = app.vendor_id())
        )
    )
  );

grant execute on all functions in schema app to authenticated, anon;
