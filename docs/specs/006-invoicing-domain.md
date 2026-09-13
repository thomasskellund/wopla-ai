# Domain 4: Invoicing — specification

Source of truth is the **legacy app only** (`wopla-combined/wopla-backend` +
`wopla-combined/wopla-frontend`) — the `wopla/` rewrite was not consulted,
same standing constraint as every prior domain. Full research report on
file; this document scopes a first pass and calls out every place the
proposal deviates from legacy and why.

## 0. Why this pass is scoped down, and a genuine oddity about this domain

Unlike chat/ordering, **legacy's invoicing has no frontend at all.** The
backend built a complete, well-organized invoicing service and GraphQL API
(`InvoiceService.php`, 1213 lines, clearly a recent deliberate build — the
newest code in the entire legacy schema, migrated 2026-03-07) — but a
repo-wide search of `wopla-combined/wopla-frontend` for any of its GraphQL
operations (`createInvoice`, `invoiceDashboard`, `markInvoicePaid`, …)
returns zero hits. There is nothing to click through, no legacy UI to
diff against, and no live bug to discover the way chat/ordering had. This
spec is written from backend code alone, and the eventual completion-gate
walkthrough will be entirely a wopla-ai-vs-itself exercise (same situation
ordering ended up in for different reasons — see `005-ordering-workflow-
parity-retro.md`).

Invoicing is also tightly coupled to a **commercial-contracts** concept
(`Contract`/`ContractOrder`: per-head vendor/customer rates, kickback %,
delivery pricing) that the ordering domain explicitly deferred. It cannot
be built as "read `daily_orders`, multiply by something" — some minimal
pricing-agreement concept has to ship alongside it. This pass ships the
smallest slice that makes Lunch invoicing work: a single per-head vendor
rate, a single per-head customer rate, and a kickback percentage, each
tied to a standing `order` and versioned by date (fixing a real legacy bug
— see §2). Full contracts (delivery pricing, per-dish pricing with
approval workflows, multi-module support) stay deferred.

## 1. What legacy actually does (condensed)

**Wopla is always the invoicing middleman.** Every invoice has a `type`:
`VENDOR_TO_WOPLA` or `WOPLA_TO_CUSTOMER` (`Invoice.php:17-18`) — there is no
direct vendor↔company invoice. This pass keeps that model (§8, confirmed).

**Entities**: `Invoice` (header: type, status, VAT, payment terms, period)
→ `InvoiceUser` (one row per counterparty within an invoice — legacy
supports billing several companies/vendors on one invoice; this pass
narrows to exactly one counterparty per invoice, §3) → `InvoiceUserModule`
(a pricing "bucket": combined-heads, per-dish, delivery, kickback, or
manual) → `InvoiceUserModuleLineItem` (the actual rows). A `reject` action
always mints an `InvoiceCreditNote` in the same transaction — legacy
enforces you cannot reject without addressing money, which is sound and
reproduced as-is (not a bug).

**Pricing** comes entirely from the commercial-contract layer, not from
`Dish.price` (which the invoice engine ignores): `ContractOrder.
vendor_per_head_price` / `company_per_head_price` for combined modules
(Lunch=1, Guest=4 in legacy — `InvoiceService.php:56`), `DishUserPrice` for
everything else (per-dish, time-versioned, approval-workflowed — out of
scope here, Lunch doesn't need it). VAT is a hardcoded flat 25%
(`InvoiceService.php:59,194`) — no multi-rate, no currency field anywhere.

**`minimum_heads` and `employee_share`** — the two columns already sitting
unused in wopla-ai's `daily_orders` — turned out to be **inert in legacy's
actual invoicing**: `minimum_heads` is a client-side-only warning when a
company types weekly heads below contract (`insufficientHeads.ts`), never
substituted for actual heads anywhere server-side; `employee_share` is a
flat per-meal amount consumed exclusively by a separate payroll-export
feature (`EmployeeSalaryExportService.php`, a Danløn-format file), never
referenced by `InvoiceService`/`InvoicePricingService` at all. **Decision
(confirmed): leave both inert this pass** — not this domain's job to wire
up (Backlog).

**Generation is 100% manual** — no cron, no async message, admin picks a
type/counterparty/date-range and calls `createInvoice`. This pass keeps
that (§6).

## 2. Legacy bugs found, and what this pass does about them

- **Viewing a DRAFT invoice doesn't actually re-sync from live data**,
  despite `getInvoice()`'s own doc comment claiming it does — the sync
  call is commented out (`InvoiceService.php:130-133`). **Fixed**: `api.
  get_invoice` re-syncs whenever the invoice is still `draft`, matching
  the *stated* intent legacy never wired up.
- **"Active" contract-order lookup just takes the highest `id`**, with no
  status or date-range filter (`ContractOrderRepository.php:41-43`) — a
  re-synced historical invoice silently re-prices against *today's* rate,
  not the rate in effect during its own billing period. **Fixed**: the
  minimal rate table this pass introduces (`billing_rates`) is genuinely
  date-versioned with a DB-level overlap guard, and lookups are always
  point-in-time against the specific date being priced, not "latest row."
- **`forceSyncInvoice`/`rejectInvoice` have no status guard** — either can
  rewrite an already-`SENT`/`PAID` invoice's numbers or mint a second
  credit note on a repeat call (`InvoiceService.php:417-422,391-396`).
  **Fixed**: sync is blocked once an invoice leaves `draft`; reject
  requires `status = 'sent'`.
- **Authorization is fully disabled** (`CustomGraphQLVoter.php:63`, the
  same `return true; //only for demo` bug found in every prior domain) —
  not reproduced; RLS + role-checked RPCs throughout, same as always.
- **Dead code not reproduced**: `VAT_TYPE_FIXED`, and every
  `payment_terms_type` except `NET_DAYS` (`END_OF_MONTH`/
  `END_OF_NEXT_MONTH`/`IMMEDIATE`/`CUSTOM`) are declared but never actually
  produced by any legacy code path — this pass only models flat-percentage
  VAT and `NET_DAYS` payment terms, since replicating unreachable enum
  values adds surface with no behavior behind it.
- **The extra-heads-as-manual-invoice-line feature looks entirely
  unreachable** — nothing in legacy ever sets a `DailyOrderEvent.type` to
  the literal `invoice_extra_heads` string `InvoiceService` filters for
  (the real, used type is plain `extra_heads`), and even the filter that
  would apply it is silently broken (wrong filter key name). **Not
  reproduced, and nothing needs to replace it**: since Lunch is billed
  per total head count, and `api.record_extra_heads` (ordering domain)
  already updates `daily_orders.total_heads` directly, an extra-heads
  adjustment already flows into invoicing for free the moment the
  invoice sums that period's heads — no separate pull-in logic needed.

## 3. Scope for this pass

**In scope**:
- Minimal billing-rate stand-in per standing `order`: vendor per-head
  price, company per-head price, kickback %, date-versioned.
- Invoice header, one counterparty per invoice (see note below), status
  lifecycle `draft → sent → paid` / `sent → rejected` (+ credit note).
- Per-week auto-generated "heads" line items (matches legacy's default
  weekly grouping without needing a grouping-mode selector), a kickback
  line item (`VENDOR_TO_WOPLA` only), and admin-addable manual line items
  — while still `draft`.
- Flat VAT (defaulted 25%, stored per-invoice), `NET_DAYS` payment terms
  with a per-type default day count (12 for vendor invoices, 8 for
  customer invoices, matching legacy's own constants).
- A computed `is_overdue` (status = `sent` and `due_date` has passed) —
  small, cheap addition; legacy has no equivalent, worth having.
- Tenant-scoped visibility: company_admin reads their own
  `wopla_to_customer` invoices; vendor_admin reads their own
  `vendor_to_wopla` invoices; admin manages everything; employees see
  none (confirmed).
- Lunch (module 1) only, matching the ordering domain's own scope.

**One documented simplification** (not put to a decision round, flagged
here instead): legacy's `Invoice`↔`InvoiceUser` is one-to-many (an admin
can bill several companies on one invoice, `sub_type: BULK`). This pass
flattens to **one counterparty per invoice** — the added fan-out modeling
for "bulk" invoices isn't worth the complexity for a first pass and
nothing observed suggests it's core to the workflow; widening to
multi-counterparty is a schema-additive change later if wanted (Backlog).

**Explicitly out of scope, deferred** (Backlog):
- Full commercial contracts (delivery pricing, per-dish `DishUserPrice`
  with approval workflow, multi-module rates) — this pass's
  `billing_rates` is a deliberately minimal stand-in, not that domain.
- The employee-salary-export/payroll-deduction feature `employee_share`
  actually belongs to.
- Enforcing `minimum_heads` as a real billing floor.
- Multi-counterparty ("bulk") invoices.
- Multi-currency, multi-rate VAT.
- An `overdue` *status* with reminder/escalation logic (this pass only
  computes the flag at read time).

## 4. Proposed data model

```sql
create type public.invoice_type as enum ('vendor_to_wopla', 'wopla_to_customer');
create type public.invoice_status as enum ('draft', 'sent', 'paid', 'rejected');
create type public.invoice_line_type as enum ('heads', 'kickback', 'manual');

-- Minimal commercial-rate stand-in for the deferred contracts domain.
-- Date-versioned and overlap-guarded — the direct fix for legacy's
-- "active contract = highest id" bug (spec §2).
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
create index invoices_company_idx on public.invoices (company_id);
create index invoices_vendor_idx on public.invoices (vendor_id);

create table public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  line_type public.invoice_line_type not null,
  description text not null,
  period_start date,   -- null for manual/kickback lines
  period_end date,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null,
  amount numeric(12,2) not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index invoice_line_items_invoice_idx on public.invoice_line_items (invoice_id);

create table public.invoice_credit_notes (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  reason text not null,
  amount numeric(12,2) not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
```

RLS (SELECT-only, same convention as every prior domain — all writes
through `api.*`):
- `billing_rates`: admin all; company_admin/vendor_admin can read the
  rate on their own orders (transparency — "what am I being charged").
- `invoices`/`invoice_line_items`/`invoice_credit_notes`: admin all;
  company_admin where `type = 'wopla_to_customer' and company_id =
  app.company_id()`; vendor_admin where `type = 'vendor_to_wopla' and
  vendor_id = app.vendor_id()`. Employees: no policy, no access.

## 5. API surface (`api` schema RPCs)

| RPC | Purpose |
|---|---|
| `api.set_billing_rate(order_id, vendor_per_head_price, company_per_head_price, kickback_percentage default 0, from_date, to_date default null)` | Admin-only. The minimal contract stand-in — overlap-guarded like `orders`. |
| `api.create_invoice(type, counterparty_id, from_date, to_date, module_id default 1)` | Admin-only. Resolves company/vendor from type + counterparty, generates weekly heads line items from `daily_orders.total_heads` × the rate in effect for each date, a kickback line (vendor invoices only), computes VAT/total/due_date. |
| `api.get_invoice(invoice_id)` | Re-syncs first if still `draft` (the §2 fix), then returns invoice + line items. Tenant-scoped by RLS. |
| `api.add_manual_line_item(invoice_id, description, quantity, unit_price)` | Admin-only, `draft` only. |
| `api.submit_invoice(invoice_id)` | `draft → sent`, admin-only. |
| `api.mark_invoice_paid(invoice_id)` | `sent → paid`, admin-only, sets `paid_at`. |
| `api.reject_invoice(invoice_id, rejection_reason, credit_note_reason, credit_note_amount)` | Requires `status = 'sent'` (the §2 fix); sets `rejected_at`, creates the credit note, in one transaction. |

## 6. Workflows

- **Admin sets up billing**: after a standing order exists (ordering
  domain), admin sets its per-head vendor/customer rates via
  `set_billing_rate` — the minimal equivalent of legacy's contract setup.
- **Admin generates an invoice**: picks a counterparty, date range;
  `create_invoice` pulls that period's `daily_orders`, prices each
  week's heads against the rate in effect for those dates, adds a
  kickback line for vendor invoices, computes VAT/total.
- **Admin reviews/adjusts**: while `draft`, can add manual line items,
  re-view (auto-resyncs), then submits.
- **Company/vendor admin views their own invoice**: read-only, tenant-
  scoped; sees whether it's overdue (computed, not stored).
- **Admin marks paid, or rejects with a credit note** if the counterparty
  disputes it — rejection is terminal for that invoice (matches legacy;
  a corrected replacement is a new invoice, not a status change back to
  draft).

## 7. Decisions (resolved 2026-09-14)

1. **Invoice model** — confirmed: keep Wopla-as-intermediary
   (`vendor_to_wopla`/`wopla_to_customer`), not direct vendor↔company
   invoicing.
2. **`minimum_heads`/`employee_share`** — confirmed: leave both inert this
   pass, tracked on the Backlog for their real owning domains (a future
   billing-floor enforcement, and a future payroll-export domain,
   respectively).
3. **Permissions** — confirmed: tenant-scoped by default (company_admin/
   vendor_admin read their own side's invoices; employees see none).
4. **Bug fixes** — confirmed: fix both (auto-sync while draft; block
   force-sync/reject once an invoice has left draft/sent appropriately).
