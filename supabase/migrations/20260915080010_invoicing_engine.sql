-- Domain: invoicing — 0002 Engine
-- See docs/specs/006-invoicing-domain.md §2/§6. `engine` already exists
-- (created by the ordering domain) — same no-grants convention.

-- Point-in-time rate lookup: the actual fix for legacy's "active contract
-- = highest id" bug. Returns null if no rate covers that date (caller's
-- problem — an invoice period with an uncovered gap just prices that
-- portion at 0, which is visible in the result rather than silently wrong).
create or replace function engine.billing_rate_for(p_order_id uuid, p_date date)
returns public.billing_rates
language sql stable
security definer
set search_path = ''
as $$
  select br from public.billing_rates br
  where br.order_id = p_order_id
    and p_date >= br.from_date and p_date <= coalesce(br.to_date, 'infinity'::date)
  limit 1
$$;

-- Sums every line item (auto-generated + manual) into the invoice's
-- subtotal/vat/total. Does not touch due_date — that's only meaningful
-- once an invoice is actually sent (api.submit_invoice sets it).
create or replace function engine.recalculate_invoice_totals(p_invoice_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
  v_subtotal numeric(12,2);
begin
  select * into v_invoice from public.invoices where id = p_invoice_id;
  select coalesce(sum(amount), 0) into v_subtotal from public.invoice_line_items where invoice_id = p_invoice_id;

  update public.invoices
  set subtotal = v_subtotal,
    vat_amount = round(v_subtotal * v_invoice.vat_rate / 100, 2),
    total = v_subtotal + round(v_subtotal * v_invoice.vat_rate / 100, 2)
  where id = p_invoice_id
  returning * into v_invoice;

  return v_invoice;
end;
$$;

-- Regenerates the auto-generated (heads + kickback) line items from live
-- daily_orders/billing_rates data; manual lines are left untouched (spec
-- §1 — matches legacy's "manual rows preserved" intent). Groups heads
-- into one line item per (ISO week, rate) pair — almost always one line
-- per week, but correctly splits a week if its rate changed mid-week.
create or replace function engine.sync_invoice(p_invoice_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
  v_counterparty_id uuid;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'invoice % not found', p_invoice_id;
  end if;

  v_counterparty_id := case when v_invoice.type = 'vendor_to_wopla' then v_invoice.vendor_id else v_invoice.company_id end;

  delete from public.invoice_line_items
  where invoice_id = p_invoice_id and line_type in ('heads', 'kickback');

  with priced_days as (
    select
      d.order_date,
      d.total_heads,
      date_trunc('week', d.order_date)::date as week_start,
      case when v_invoice.type = 'vendor_to_wopla' then br.vendor_per_head_price else br.company_per_head_price end as unit_price,
      br.kickback_percentage
    from public.daily_orders d
    join public.orders o on o.id = d.order_id
    left join public.billing_rates br
      on br.order_id = o.id and d.order_date >= br.from_date and d.order_date <= coalesce(br.to_date, 'infinity'::date)
    where o.module_id = v_invoice.module_id
      and d.order_date between v_invoice.from_date and v_invoice.to_date
      and d.status <> 'cancelled'
      and d.total_heads > 0
      and (case when v_invoice.type = 'vendor_to_wopla' then o.vendor_id else o.company_id end) = v_counterparty_id
  ),
  weekly as (
    select week_start, unit_price, min(order_date) as period_start, max(order_date) as period_end, sum(total_heads) as heads
    from priced_days
    where unit_price is not null
    group by week_start, unit_price
  )
  insert into public.invoice_line_items (invoice_id, line_type, description, period_start, period_end, quantity, unit_price, amount)
  select
    p_invoice_id, 'heads',
    'Heads ' || to_char(period_start, 'YYYY-MM-DD') || ' – ' || to_char(period_end, 'YYYY-MM-DD'),
    period_start, period_end, heads, unit_price, heads * unit_price
  from weekly
  order by week_start;

  if v_invoice.type = 'vendor_to_wopla' then
    insert into public.invoice_line_items (invoice_id, line_type, description, period_start, period_end, quantity, unit_price, amount)
    select
      p_invoice_id, 'kickback', 'Kickback', v_invoice.from_date, v_invoice.to_date, 1,
      -round(sum(d.total_heads * br.vendor_per_head_price * br.kickback_percentage / 100), 2),
      -round(sum(d.total_heads * br.vendor_per_head_price * br.kickback_percentage / 100), 2)
    from public.daily_orders d
    join public.orders o on o.id = d.order_id
    join public.billing_rates br
      on br.order_id = o.id and d.order_date >= br.from_date and d.order_date <= coalesce(br.to_date, 'infinity'::date)
    where o.module_id = v_invoice.module_id
      and d.order_date between v_invoice.from_date and v_invoice.to_date
      and d.status <> 'cancelled'
      and d.total_heads > 0
      and o.vendor_id = v_counterparty_id
      and br.kickback_percentage > 0
    having sum(d.total_heads * br.vendor_per_head_price * br.kickback_percentage / 100) > 0;
  end if;

  perform engine.recalculate_invoice_totals(p_invoice_id);
  update public.invoices set last_synced_at = now() where id = p_invoice_id returning * into v_invoice;
  return v_invoice;
end;
$$;
