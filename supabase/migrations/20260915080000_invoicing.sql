-- Domain: invoicing — 0001 Schema
-- See docs/specs/006-invoicing-domain.md for the full spec this implements.
-- Lunch (module 1) only, mirroring the ordering domain's own scope.

create type public.invoice_type as enum ('vendor_to_wopla', 'wopla_to_customer');
create type public.invoice_status as enum ('draft', 'sent', 'paid', 'rejected');
create type public.invoice_line_type as enum ('heads', 'kickback', 'manual');

-- Minimal commercial-rate stand-in for the deferred contracts domain —
-- just enough for Lunch invoicing: a per-head vendor rate, a per-head
-- customer rate, and a kickback %, versioned by date. FIX vs legacy:
-- legacy's "active contract" lookup just takes the highest id with no
-- date/status filter, so re-syncing an old invoice re-prices it against
-- whatever rate exists *today* (spec §2). This table is genuinely
-- date-versioned with a DB-level overlap guard, so a lookup for a given
-- date always resolves to the rate actually in effect then.
create table public.billing_rates (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  vendor_per_head_price numeric(10,2) not null check (vendor_per_head_price >= 0),
  company_per_head_price numeric(10,2) not null check (company_per_head_price >= 0),
  kickback_percentage numeric(5,2) not null default 0 check (kickback_percentage between 0 and 100),
  from_date date not null,
  to_date date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
alter table public.billing_rates add constraint billing_rates_no_overlap
  exclude using gist (
    order_id with =,
    daterange(from_date, coalesce(to_date, 'infinity'::date), '[]') with &&
  );
create index billing_rates_order_idx on public.billing_rates (order_id);

-- Wopla is always the invoicing middleman (spec §7, confirmed): a vendor
-- bills Wopla (vendor_to_wopla), Wopla separately bills the company
-- (wopla_to_customer) — no direct vendor<->company invoice.
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  type public.invoice_type not null,
  company_id uuid references public.companies (id),
  vendor_id uuid references public.vendors (id),
  module_id smallint not null references public.modules (id) default 1,
  from_date date not null,
  to_date date not null,
  status public.invoice_status not null default 'draft',
  vat_rate numeric(5,2) not null default 25.00,
  subtotal numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_terms_days int not null,
  due_date date,
  last_synced_at timestamptz,
  sent_at timestamptz,
  paid_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_counterparty_shape check (
    (type = 'wopla_to_customer' and company_id is not null and vendor_id is null)
    or (type = 'vendor_to_wopla' and vendor_id is not null and company_id is null)
  ),
  constraint invoice_date_range_valid check (to_date >= from_date)
);
select app.add_updated_at('public.invoices');
create index invoices_company_idx on public.invoices (company_id) where company_id is not null;
create index invoices_vendor_idx on public.invoices (vendor_id) where vendor_id is not null;

-- Auto-generated (heads/kickback) rows are wiped and rebuilt on every
-- sync; manual rows are preserved (matches legacy's "manual" flag intent
-- — see engine.sync_invoice).
create table public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  line_type public.invoice_line_type not null,
  description text not null,
  period_start date,
  period_end date,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null,
  amount numeric(12,2) not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index invoice_line_items_invoice_idx on public.invoice_line_items (invoice_id);

-- Always created alongside a rejection, never standalone (spec §1 — this
-- coupling is a legacy design choice worth keeping, not a bug).
create table public.invoice_credit_notes (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  reason text not null,
  amount numeric(12,2) not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index invoice_credit_notes_invoice_idx on public.invoice_credit_notes (invoice_id);

-- ------------------------------------------------------------------- RLS
-- SELECT-only everywhere, same convention as chat/ordering — every write
-- goes through api.* RPCs. Employees have no policy anywhere in this
-- domain (spec §7, confirmed: they see no invoices at all).
alter table public.billing_rates enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.invoice_credit_notes enable row level security;

create policy billing_rates_admin on public.billing_rates for select to authenticated
  using (app.is_admin());
create policy billing_rates_own_read on public.billing_rates for select to authenticated
  using (
    exists (
      select 1 from public.orders o where o.id = billing_rates.order_id
        and (
          (app.role() in ('company_admin', 'employee') and o.company_id = app.company_id())
          or (app.role() = 'vendor_admin' and o.vendor_id = app.vendor_id())
        )
    )
  );

create policy invoices_admin on public.invoices for select to authenticated
  using (app.is_admin());
create policy invoices_company_read on public.invoices for select to authenticated
  using (type = 'wopla_to_customer' and app.role() = 'company_admin' and company_id = app.company_id());
create policy invoices_vendor_read on public.invoices for select to authenticated
  using (type = 'vendor_to_wopla' and app.role() = 'vendor_admin' and vendor_id = app.vendor_id());

create policy invoice_line_items_read on public.invoice_line_items for select to authenticated
  using (
    exists (
      select 1 from public.invoices i where i.id = invoice_line_items.invoice_id
        and (
          app.is_admin()
          or (i.type = 'wopla_to_customer' and app.role() = 'company_admin' and i.company_id = app.company_id())
          or (i.type = 'vendor_to_wopla' and app.role() = 'vendor_admin' and i.vendor_id = app.vendor_id())
        )
    )
  );
create policy invoice_credit_notes_read on public.invoice_credit_notes for select to authenticated
  using (
    exists (
      select 1 from public.invoices i where i.id = invoice_credit_notes.invoice_id
        and (
          app.is_admin()
          or (i.type = 'wopla_to_customer' and app.role() = 'company_admin' and i.company_id = app.company_id())
          or (i.type = 'vendor_to_wopla' and app.role() = 'vendor_admin' and i.vendor_id = app.vendor_id())
        )
    )
  );

grant execute on all functions in schema app to authenticated, anon;
