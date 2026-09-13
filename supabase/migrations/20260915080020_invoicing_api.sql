-- Domain: invoicing — 0003 API RPCs
-- See docs/specs/006-invoicing-domain.md §5. Every function re-validates
-- role/tenancy itself. Params are p_-prefixed throughout, same convention
-- as chat/ordering.

-- Payment-terms day counts match legacy's own constants (only NET_DAYS is
-- ever actually used there — the other declared modes are dead code, not
-- modeled here at all, spec §2).
create or replace function app.default_payment_terms_days(p_type public.invoice_type)
returns int
language sql immutable
as $$
  select case p_type when 'vendor_to_wopla' then 12 else 8 end
$$;

-- Admin-only. The minimal contract stand-in — overlap-guarded like
-- public.orders itself.
create or replace function api.set_billing_rate(
  p_order_id uuid, p_vendor_per_head_price numeric, p_company_per_head_price numeric,
  p_kickback_percentage numeric default 0, p_from_date date default current_date, p_to_date date default null
)
returns public.billing_rates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.billing_rates;
begin
  if not app.is_admin() then
    raise exception 'only admin can set billing rates';
  end if;

  insert into public.billing_rates (order_id, vendor_per_head_price, company_per_head_price, kickback_percentage, from_date, to_date, created_by)
  values (p_order_id, p_vendor_per_head_price, p_company_per_head_price, p_kickback_percentage, p_from_date, p_to_date, (select auth.uid()))
  returning * into v_row;

  return v_row;
end;
$$;

-- Convenience read for "what am I being charged right now" (spec §4 —
-- billing_rates are readable by both sides of the relationship, this
-- just saves the frontend from re-deriving the point-in-time lookup).
create or replace function api.get_current_billing_rate(p_order_id uuid)
returns public.billing_rates
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.orders o where o.id = p_order_id
      and (
        app.is_admin()
        or (app.role() in ('company_admin', 'employee') and o.company_id = app.company_id())
        or (app.role() = 'vendor_admin' and o.vendor_id = app.vendor_id())
      )
  ) then
    raise exception 'not allowed to view this order''s billing rate';
  end if;

  return engine.billing_rate_for(p_order_id, current_date);
end;
$$;

-- Admin-only. Resolves company/vendor from type + counterparty, then
-- generates line items from live data via engine.sync_invoice.
create or replace function api.create_invoice(
  p_type public.invoice_type, p_counterparty_id uuid, p_from_date date, p_to_date date, p_module_id smallint default 1
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.invoices;
begin
  if not app.is_admin() then
    raise exception 'only admin can create invoices';
  end if;

  insert into public.invoices (type, company_id, vendor_id, module_id, from_date, to_date, payment_terms_days, created_by)
  values (
    p_type,
    case when p_type = 'wopla_to_customer' then p_counterparty_id else null end,
    case when p_type = 'vendor_to_wopla' then p_counterparty_id else null end,
    p_module_id, p_from_date, p_to_date, app.default_payment_terms_days(p_type), (select auth.uid())
  )
  returning * into v_row;

  return engine.sync_invoice(v_row.id);
end;
$$;

-- Re-syncs first if still `draft` (spec §2's fix for legacy's dead
-- auto-sync-on-read code path), then returns the invoice. Re-implements
-- the tenant check RLS would otherwise apply, since this function's own
-- write (the sync) runs as owner and bypasses RLS.
create or replace function api.get_invoice(p_invoice_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.invoices;
begin
  select * into v_row from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'invoice not found';
  end if;
  if not (
    app.is_admin()
    or (v_row.type = 'wopla_to_customer' and app.role() = 'company_admin' and v_row.company_id = app.company_id())
    or (v_row.type = 'vendor_to_wopla' and app.role() = 'vendor_admin' and v_row.vendor_id = app.vendor_id())
  ) then
    raise exception 'invoice not found';
  end if;

  if v_row.status = 'draft' then
    v_row := engine.sync_invoice(p_invoice_id);
  end if;
  return v_row;
end;
$$;

-- Admin-only, draft only — can't add lines to an invoice that's already
-- been sent.
create or replace function api.add_manual_line_item(p_invoice_id uuid, p_description text, p_quantity numeric, p_unit_price numeric)
returns public.invoice_line_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
  v_row public.invoice_line_items;
begin
  if not app.is_admin() then
    raise exception 'only admin can add invoice line items';
  end if;
  select * into v_invoice from public.invoices where id = p_invoice_id;
  if not found or v_invoice.status <> 'draft' then
    raise exception 'can only add line items to a draft invoice';
  end if;

  insert into public.invoice_line_items (invoice_id, line_type, description, quantity, unit_price, amount, created_by)
  values (p_invoice_id, 'manual', p_description, p_quantity, p_unit_price, p_quantity * p_unit_price, (select auth.uid()))
  returning * into v_row;

  perform engine.recalculate_invoice_totals(p_invoice_id);
  return v_row;
end;
$$;

-- draft -> sent. Sets due_date here, not at sync time — a due date is
-- only meaningful once an invoice is actually sent (spec §6).
create or replace function api.submit_invoice(p_invoice_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.invoices;
begin
  if not app.is_admin() then
    raise exception 'only admin can submit invoices';
  end if;
  select * into v_row from public.invoices where id = p_invoice_id;
  if not found or v_row.status <> 'draft' then
    raise exception 'only a draft invoice can be submitted';
  end if;

  update public.invoices
  set status = 'sent', sent_at = now(), due_date = current_date + v_row.payment_terms_days
  where id = p_invoice_id
  returning * into v_row;

  return v_row;
end;
$$;

-- sent -> paid.
create or replace function api.mark_invoice_paid(p_invoice_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.invoices;
begin
  if not app.is_admin() then
    raise exception 'only admin can mark invoices paid';
  end if;
  select * into v_row from public.invoices where id = p_invoice_id;
  if not found or v_row.status <> 'sent' then
    raise exception 'only a sent invoice can be marked paid';
  end if;

  update public.invoices set status = 'paid', paid_at = now() where id = p_invoice_id returning * into v_row;
  return v_row;
end;
$$;

-- sent -> rejected. FIX vs legacy: requires status = 'sent' (legacy has
-- no status guard here at all, spec §2) — a draft or already-resolved
-- invoice can't be "rejected" repeatedly. Always creates the credit note
-- in the same transaction (spec §1 — a legacy design choice kept as-is,
-- not a bug: you can't reject without addressing the money).
create or replace function api.reject_invoice(
  p_invoice_id uuid, p_rejection_reason text, p_credit_note_reason text, p_credit_note_amount numeric
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.invoices;
begin
  if not app.is_admin() then
    raise exception 'only admin can reject invoices';
  end if;
  select * into v_row from public.invoices where id = p_invoice_id;
  if not found or v_row.status <> 'sent' then
    raise exception 'only a sent invoice can be rejected';
  end if;

  update public.invoices
  set status = 'rejected', rejected_at = now(), rejection_reason = p_rejection_reason
  where id = p_invoice_id
  returning * into v_row;

  insert into public.invoice_credit_notes (invoice_id, reason, amount, created_by)
  values (p_invoice_id, p_credit_note_reason, p_credit_note_amount, (select auth.uid()));

  return v_row;
end;
$$;

grant execute on all functions in schema api to authenticated;
alter default privileges in schema api grant execute on functions to authenticated;

-- app.default_payment_terms_days was just added in this file — redo the
-- blanket app-schema grant so it's covered too (same pattern every prior
-- domain has needed).
grant execute on all functions in schema app to authenticated, anon;
