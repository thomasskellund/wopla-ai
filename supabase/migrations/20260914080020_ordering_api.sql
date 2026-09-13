-- Domain: ordering — 0003 API RPCs
-- See docs/specs/004-ordering-domain.md §6. Every function re-validates
-- role/tenancy/grace itself; none trust the caller's arguments. Params are
-- p_-prefixed throughout, same convention as chat, to avoid PL/pgSQL
-- ambiguity against identically named table/output columns.

-- ------------------------------------------------------------------ dishes
-- Minimal — this isn't a menu-management domain (spec §3).
create or replace function api.create_dish(p_name text)
returns public.dishes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.dishes;
begin
  if app.role() <> 'vendor_admin' then
    raise exception 'only a vendor can add its own dishes';
  end if;
  insert into public.dishes (vendor_id, name) values (app.vendor_id(), p_name) returning * into v_row;
  return v_row;
end;
$$;

create or replace function api.set_dish_status(p_dish_id uuid, p_status public.entity_status)
returns public.dishes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.dishes;
begin
  update public.dishes set status = p_status
  where id = p_dish_id and vendor_id = app.vendor_id() and app.role() = 'vendor_admin'
  returning * into v_row;
  if not found then
    raise exception 'dish not found or not allowed';
  end if;
  return v_row;
end;
$$;

-- ------------------------------------------------------------------ orders
-- Bootstraps the standing order. Nothing else in ordering is reachable
-- before this exists (spec §7). Admin or company_admin only — the
-- exclusion constraint on public.orders raises on an overlapping window.
create or replace function api.create_order(p_company_id uuid, p_vendor_id uuid, p_from_date date, p_to_date date default null, p_module_id smallint default 1)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.orders;
begin
  if not (
    app.is_admin()
    or (app.role() = 'company_admin' and p_company_id = app.company_id())
  ) then
    raise exception 'not allowed to create an order for this company';
  end if;

  insert into public.orders (company_id, vendor_id, module_id, from_date, to_date, created_by)
  values (p_company_id, p_vendor_id, p_module_id, p_from_date, p_to_date, (select auth.uid()))
  returning * into v_row;

  return v_row;
end;
$$;

-- Admin-managed mode: set the standing weekly heads for one dish across
-- any subset of weekdays (p_weekday_heads: {"mon": 20, "tue": 18, ...}).
-- Usable by admin, or by company_admin when their own company is in
-- admin-managed mode (spec §7's "company admin types head counts
-- directly" workflow) — but never to flip the mode itself (spec §8.2,
-- enforced separately by app.protect_company_admin_managed_order).
create or replace function api.save_order_dish_heads(p_order_id uuid, p_dish_id uuid, p_weekday_heads jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_admin_managed boolean;
  v_wd public.weekday;
  v_key text;
begin
  select * into v_order from public.orders where id = p_order_id and deleted_at is null;
  if not found then
    raise exception 'order not found';
  end if;
  select admin_managed_order into v_admin_managed from public.companies where id = v_order.company_id;

  if not (
    app.is_admin()
    or (app.role() = 'company_admin' and v_order.company_id = app.company_id() and v_admin_managed)
  ) then
    raise exception 'not allowed to set standing heads for this order';
  end if;

  for v_key in select jsonb_object_keys(p_weekday_heads) loop
    v_wd := v_key::public.weekday;
    insert into public.order_dish_heads (order_id, dish_id, weekday, heads)
    values (p_order_id, p_dish_id, v_wd, (p_weekday_heads ->> v_key)::int)
    on conflict (order_id, dish_id, weekday) do update set heads = excluded.heads;
    perform engine.recompute_future_daily_heads_for_weekday(p_order_id, v_wd);
  end loop;
end;
$$;

-- Employee-managed mode: the caller's own standing weekly choice.
-- p_dish_id null = no lunch that weekday.
create or replace function api.set_my_weekly_preference(p_order_id uuid, p_weekday public.weekday, p_dish_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_admin_managed boolean;
  v_profile_id uuid := (select auth.uid());
begin
  if v_profile_id is null then
    raise exception 'not authenticated';
  end if;
  select * into v_order from public.orders where id = p_order_id and deleted_at is null;
  if not found then
    raise exception 'order not found';
  end if;
  select admin_managed_order into v_admin_managed from public.companies where id = v_order.company_id;
  if v_admin_managed then
    raise exception 'this company is admin-managed; employees do not set individual preferences';
  end if;
  if not (app.role() = 'employee' and v_order.company_id = app.company_id()) then
    raise exception 'not allowed to set a preference on this order';
  end if;

  if p_dish_id is null then
    delete from public.user_dish_preferences
    where order_id = p_order_id and profile_id = v_profile_id and weekday = p_weekday;
  else
    insert into public.user_dish_preferences (order_id, profile_id, weekday, dish_id)
    values (p_order_id, v_profile_id, p_weekday, p_dish_id)
    on conflict (order_id, profile_id, weekday) do update set dish_id = excluded.dish_id, updated_at = now();
  end if;

  perform engine.recompute_standing_heads(p_order_id, p_weekday);
  perform engine.recompute_future_daily_heads_for_weekday(p_order_id, p_weekday);
end;
$$;

-- Employee's view: a week's worth of dates, each date's effective dish
-- (override if present, else the standing choice), and per-date
-- editability. Materializes the week's daily orders as a side effect
-- (through the engine, not a raw write) so status/locking is accurate.
create or replace function api.get_my_week(p_order_id uuid, p_week_start date)
returns table (
  order_date date,
  weekday public.weekday,
  dish_id uuid,
  dish_name text,
  is_override boolean,
  status public.daily_order_status,
  can_edit boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_profile_id uuid := (select auth.uid());
  d date;
  v_daily public.daily_orders;
begin
  if v_profile_id is null then
    raise exception 'not authenticated';
  end if;
  select * into v_order from public.orders where id = p_order_id and deleted_at is null;
  if not found or v_order.company_id <> app.company_id() then
    raise exception 'order not found';
  end if;

  for d in select generate_series(p_week_start, p_week_start + 6, interval '1 day')::date loop
    v_daily := engine.get_or_create_daily_order(p_order_id, d);

    return query
    select
      d,
      engine.weekday_of(d),
      case when dop.id is not null then dop.dish_id else udp.dish_id end,
      dh.name,
      (dop.id is not null),
      v_daily.status,
      (v_daily.status = 'active')
    from (select 1 as x) base
    left join public.user_dish_preferences udp
      on udp.order_id = p_order_id and udp.profile_id = v_profile_id and udp.weekday = engine.weekday_of(d)
    left join public.daily_order_preferences dop
      on dop.daily_order_id = v_daily.id and dop.profile_id = v_profile_id
    left join public.dishes dh
      on dh.id = case when dop.id is not null then dop.dish_id else udp.dish_id end;
  end loop;
end;
$$;

-- Employee's one-off override for one date. Deletes the override row if
-- it now matches the standing choice again — legacy semantics: "override
-- absent" means "follow the standing choice for that weekday."
create or replace function api.set_my_daily_choice(p_order_id uuid, p_order_date date, p_dish_id uuid)
returns public.daily_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_admin_managed boolean;
  v_profile_id uuid := (select auth.uid());
  v_daily public.daily_orders;
  v_standing_dish uuid;
begin
  if v_profile_id is null then
    raise exception 'not authenticated';
  end if;
  select * into v_order from public.orders where id = p_order_id and deleted_at is null;
  if not found or v_order.company_id <> app.company_id() or app.role() <> 'employee' then
    raise exception 'not allowed to set a daily choice on this order';
  end if;
  select admin_managed_order into v_admin_managed from public.companies where id = v_order.company_id;
  if v_admin_managed then
    raise exception 'this company is admin-managed; employees do not set individual daily choices';
  end if;

  v_daily := engine.get_or_create_daily_order(p_order_id, p_order_date);
  if v_daily.status <> 'active' or not engine.can_make_minor_update(v_order.company_id, v_order.module_id, p_order_date) then
    raise exception 'grace period expired for this date';
  end if;

  select dish_id into v_standing_dish
  from public.user_dish_preferences
  where order_id = p_order_id and profile_id = v_profile_id and weekday = engine.weekday_of(p_order_date);

  if p_dish_id is not distinct from v_standing_dish then
    delete from public.daily_order_preferences where daily_order_id = v_daily.id and profile_id = v_profile_id;
  else
    insert into public.daily_order_preferences (daily_order_id, profile_id, dish_id)
    values (v_daily.id, v_profile_id, p_dish_id)
    on conflict (daily_order_id, profile_id) do update set dish_id = excluded.dish_id, updated_at = now();
  end if;

  perform engine.recompute_daily_heads(v_daily.id);
  select * into v_daily from public.daily_orders where id = v_daily.id;
  return v_daily;
end;
$$;

-- Cancellation propagates to every employee's daily choice for this date
-- (spec §7). Validated via the major-update rule (is_cancellation => true,
-- which follows the minor rule instead when cancel_grace_period is set);
-- admin bypasses per engine.can_make_major_update.
create or replace function api.cancel_daily_order(p_order_id uuid, p_order_date date, p_note text default null)
returns public.daily_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_daily public.daily_orders;
begin
  select * into v_order from public.orders where id = p_order_id and deleted_at is null;
  if not found then
    raise exception 'order not found';
  end if;
  if not (app.is_admin() or (app.role() = 'company_admin' and v_order.company_id = app.company_id())) then
    raise exception 'not allowed to cancel this order date';
  end if;

  v_daily := engine.get_or_create_daily_order(p_order_id, p_order_date);
  if v_daily.status = 'cancelled' then
    return v_daily;
  end if;
  if not engine.can_make_major_update(v_order.company_id, v_order.module_id, p_order_date, true) then
    raise exception 'grace period expired for cancelling this date';
  end if;

  update public.daily_orders
  set status = 'cancelled', cancelled_at = now(), cancelled_by = (select auth.uid()), cancellation_note = p_note,
    total_heads = 0
  where id = v_daily.id
  returning * into v_daily;

  delete from public.daily_order_dish_heads where daily_order_id = v_daily.id;

  return v_daily;
end;
$$;

create or replace function api.uncancel_daily_order(p_order_id uuid, p_order_date date)
returns public.daily_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_daily public.daily_orders;
begin
  select * into v_order from public.orders where id = p_order_id and deleted_at is null;
  if not found then
    raise exception 'order not found';
  end if;
  if not (app.is_admin() or (app.role() = 'company_admin' and v_order.company_id = app.company_id())) then
    raise exception 'not allowed to un-cancel this order date';
  end if;

  select * into v_daily from public.daily_orders where order_id = p_order_id and order_date = p_order_date;
  if not found or v_daily.status <> 'cancelled' then
    raise exception 'this date is not cancelled';
  end if;
  if not engine.can_make_major_update(v_order.company_id, v_order.module_id, p_order_date, true) then
    raise exception 'grace period expired for un-cancelling this date';
  end if;

  update public.daily_orders
  set status = 'active', cancelled_at = null, cancelled_by = null, cancellation_note = null
  where id = v_daily.id
  returning * into v_daily;

  perform engine.recompute_daily_heads(v_daily.id);
  select * into v_daily from public.daily_orders where id = v_daily.id;
  return v_daily;
end;
$$;

-- Vendor's per-company per-dish breakdown for one date, across all its
-- standing orders. Materializes the date for every matching order first.
create or replace function api.get_vendor_headcount(p_vendor_id uuid, p_order_date date)
returns table (
  order_id uuid,
  daily_order_id uuid,
  company_id uuid,
  company_name text,
  dish_id uuid,
  dish_name text,
  heads int,
  status public.daily_order_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if not (app.is_admin() or (app.role() = 'vendor_admin' and p_vendor_id = app.vendor_id())) then
    raise exception 'not allowed to view this vendor''s headcount';
  end if;

  for r in
    select o.id as order_id from public.orders o
    where o.vendor_id = p_vendor_id and o.deleted_at is null
      and o.from_date <= p_order_date and (o.to_date is null or o.to_date >= p_order_date)
  loop
    perform engine.get_or_create_daily_order(r.order_id, p_order_date);
  end loop;

  return query
  select d.order_id, d.id, d.company_id, c.name, h.dish_id, dh.name, h.heads, d.status
  from public.daily_orders d
  join public.companies c on c.id = d.company_id
  join public.daily_order_dish_heads h on h.daily_order_id = d.id
  join public.dishes dh on dh.id = h.dish_id
  where d.vendor_id = p_vendor_id and d.order_date = p_order_date
  order by c.name, dh.name;
end;
$$;

-- Vendor-recorded ad-hoc adjustment (phone/WhatsApp orders); bakes into
-- daily_order_dish_heads immediately, audit-logged to daily_order_events.
create or replace function api.record_extra_heads(p_daily_order_id uuid, p_dish_id uuid, p_extra_heads int, p_note text default null)
returns public.daily_order_dish_heads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_daily public.daily_orders;
  v_current int;
  v_row public.daily_order_dish_heads;
begin
  select * into v_daily from public.daily_orders where id = p_daily_order_id;
  if not found then
    raise exception 'daily order not found';
  end if;
  if not (app.is_admin() or (app.role() = 'vendor_admin' and v_daily.vendor_id = app.vendor_id())) then
    raise exception 'not allowed to adjust this daily order';
  end if;

  select heads into v_current from public.daily_order_dish_heads
  where daily_order_id = p_daily_order_id and dish_id = p_dish_id;
  v_current := coalesce(v_current, 0);

  insert into public.daily_order_dish_heads (daily_order_id, dish_id, heads)
  values (p_daily_order_id, p_dish_id, greatest(v_current + p_extra_heads, 0))
  on conflict (daily_order_id, dish_id) do update set heads = greatest(daily_order_dish_heads.heads + p_extra_heads, 0)
  returning * into v_row;

  insert into public.daily_order_events (daily_order_id, dish_id, original_heads, extra_heads, note, added_by)
  values (p_daily_order_id, p_dish_id, v_current, p_extra_heads, p_note, (select auth.uid()));

  update public.daily_orders
  set total_heads = (select coalesce(sum(heads), 0) from public.daily_order_dish_heads where daily_order_id = p_daily_order_id)
  where id = p_daily_order_id;

  return v_row;
end;
$$;

-- Minimal vendor directory for the order-bootstrap picker. vendors_client_
-- read (see 0001) only admits a vendor once an order links it to the
-- caller's company — exactly the relationship this RPC exists to create,
-- so that policy can't be used to browse candidates first. A narrow
-- security-definer directory (name only, nothing vendor-internal) breaks
-- the chicken-and-egg instead of loosening vendors' general RLS — the
-- same class of gap we found live in legacy's own cold-start order form.
create or replace function api.list_available_vendors()
returns table (id uuid, name text)
language sql
security definer
set search_path = ''
as $$
  select v.id, v.name from public.vendors v
  where v.deleted_at is null and v.status = 'active'
    and (select app.role() in ('admin', 'company_admin'))
$$;

grant execute on all functions in schema api to authenticated;
alter default privileges in schema api grant execute on functions to authenticated;
