-- Domain: ordering — 0002 Engine
-- See docs/specs/004-ordering-domain.md §5. `engine` is internal,
-- security-definer, no grants at all (per this project's architecture) —
-- callers reach it only through app.* helpers or api.* RPCs, both of which
-- run under a privileged migration-time role, so no schema grant is needed.
create schema if not exists engine;

-- ------------------------------------------------------------- weekday helpers
create or replace function engine.weekday_of(p_date date)
returns public.weekday
language sql immutable
as $$
  select (array['mon','tue','wed','thu','fri','sat','sun']::public.weekday[])[extract(isodow from p_date)::int]
$$;

create or replace function engine.isodow_of_weekday(p_weekday public.weekday)
returns int
language sql immutable
as $$
  select array_position(array['mon','tue','wed','thu','fri','sat','sun']::public.weekday[], p_weekday)
$$;

-- --------------------------------------------------------------- calendar
create or replace function engine.is_working_day(p_company_id uuid, p_date date)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select case extract(isodow from p_date)::int
    when 1 then coalesce((select mon from public.company_working_days where company_id = p_company_id), true)
    when 2 then coalesce((select tue from public.company_working_days where company_id = p_company_id), true)
    when 3 then coalesce((select wed from public.company_working_days where company_id = p_company_id), true)
    when 4 then coalesce((select thu from public.company_working_days where company_id = p_company_id), true)
    when 5 then coalesce((select fri from public.company_working_days where company_id = p_company_id), true)
    when 6 then coalesce((select sat from public.company_working_days where company_id = p_company_id), false)
    when 7 then coalesce((select sun from public.company_working_days where company_id = p_company_id), false)
  end
$$;

-- 'general' | 'company' | 'employee' | null, checked in that order.
-- FIX vs legacy: an exclusion only suppresses the specific holiday row it
-- names, not every holiday sharing that date (spec §1/§4).
create or replace function engine.holiday_type(p_company_id uuid, p_profile_id uuid, p_module_id smallint, p_date date)
returns text
language sql stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.public_holidays h
      where h.holiday_date = p_date and (h.module_id is null or h.module_id = p_module_id)
        and not exists (
          select 1 from public.public_holiday_exclusions e
          where e.holiday_id = h.id and e.company_id = p_company_id
        )
    ) then 'general'
    when exists (
      select 1 from public.company_holidays ch
      where ch.company_id = p_company_id and ch.holiday_date = p_date
        and (ch.module_id is null or ch.module_id = p_module_id)
    ) then 'company'
    when p_profile_id is not null and exists (
      select 1 from public.employee_absences ea
      where ea.profile_id = p_profile_id and ea.absence_date = p_date
    ) then 'employee'
    else null
  end
$$;

-- ---------------------------------------------------------- grace periods
create or replace function engine.grace_period(p_company_id uuid, p_module_id smallint)
returns public.grace_periods
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select gp from public.grace_periods gp where gp.company_id = p_company_id and gp.module_id = p_module_id),
    (select gp from public.grace_periods gp where gp.company_id is null and gp.module_id = p_module_id)
  )
$$;

-- Backward-walk N *working* days from p_anchor_date: a day that isn't a
-- working day at all (weekend, per company_working_days) is skipped
-- without counting; a general public holiday is also skipped without
-- counting (spec §1: "skipping general holidays entirely"); a
-- company-specific holiday still counts as one of the N days even though
-- it's a holiday ("counting company-specific holidays"), reproducing
-- legacy's algorithm faithfully. Combines with the cutoff time using the
-- session's time zone — this project assumes a single Danish tenant
-- timezone, same as legacy.
create or replace function engine.grace_cutoff_instant(p_company_id uuid, p_module_id smallint, p_anchor_date date, p_days int, p_time time)
returns timestamptz
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_cursor date := p_anchor_date;
  v_remaining int := p_days;
begin
  while v_remaining > 0 loop
    v_cursor := v_cursor - 1;
    if not engine.is_working_day(p_company_id, v_cursor) then
      continue;
    end if;
    if engine.holiday_type(p_company_id, null, p_module_id, v_cursor) = 'general' then
      continue;
    end if;
    v_remaining := v_remaining - 1;
  end loop;
  return (v_cursor + p_time)::timestamptz;
end;
$$;

-- Day-level tweak: editable until `minor_update_days` working days before
-- p_order_date itself, evaluated against THAT date every time (the §2 fix
-- for legacy's "locking driven by today's clock" bug — this ignores any
-- notion of "today" except for the final now()-vs-cutoff comparison).
create or replace function engine.can_make_minor_update(p_company_id uuid, p_module_id smallint, p_order_date date)
returns boolean
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_gp public.grace_periods;
begin
  if app.is_admin() then
    return true; -- admin bypasses every cutoff, on purpose (spec §1)
  end if;
  v_gp := engine.grace_period(p_company_id, p_module_id);
  return now() < engine.grace_cutoff_instant(p_company_id, p_module_id, p_order_date, v_gp.minor_update_days, v_gp.minor_update_time);
end;
$$;

-- A change big enough to trip the threshold, or a cancellation (unless
-- cancel_grace_period says cancellation follows the minor rule instead).
-- Anchored at the Monday of p_order_date's week — Lunch-specific; Fruit's
-- Thursday-anchored variant is deferred (Backlog).
create or replace function engine.can_make_major_update(p_company_id uuid, p_module_id smallint, p_order_date date, p_is_cancellation boolean default false)
returns boolean
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_gp public.grace_periods;
  v_monday date;
begin
  if app.is_admin() then
    return true;
  end if;
  v_gp := engine.grace_period(p_company_id, p_module_id);
  if p_is_cancellation and v_gp.cancel_grace_period then
    return engine.can_make_minor_update(p_company_id, p_module_id, p_order_date);
  end if;
  v_monday := p_order_date - (extract(isodow from p_order_date)::int - 1);
  return now() < engine.grace_cutoff_instant(p_company_id, p_module_id, v_monday, v_gp.major_update_days, v_gp.major_update_time);
end;
$$;

-- Threshold read from the order's own module (§2 fix — legacy hardcodes
-- Lunch's threshold regardless of which module is being edited).
create or replace function engine.classify_update(p_order_id uuid, p_order_date date, p_proposed_heads int)
returns table (is_minor boolean, delta int)
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_gp public.grace_periods;
  v_current_heads int;
begin
  select * into v_order from public.orders where id = p_order_id;
  v_gp := engine.grace_period(v_order.company_id, v_order.module_id);
  select coalesce(sum(h.heads), 0) into v_current_heads
  from public.daily_orders d join public.daily_order_dish_heads h on h.daily_order_id = d.id
  where d.order_id = p_order_id and d.order_date = p_order_date;

  delta := abs(p_proposed_heads - v_current_heads);
  is_minor := delta <= v_gp.threshold;
  return next;
end;
$$;

-- ------------------------------------------------------------ recompute
-- Employee-managed mode only: recounts user_dish_preferences into
-- order_dish_heads for one weekday.
create or replace function engine.recompute_standing_heads(p_order_id uuid, p_weekday public.weekday)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.order_dish_heads
  where order_id = p_order_id and weekday = p_weekday;

  insert into public.order_dish_heads (order_id, dish_id, weekday, heads)
  select p_order_id, udp.dish_id, p_weekday, count(*)
  from public.user_dish_preferences udp
  where udp.order_id = p_order_id and udp.weekday = p_weekday and udp.dish_id is not null
  group by udp.dish_id;
end;
$$;

-- Recounts one daily order's heads. Admin-managed mode mirrors the
-- standing weekly heads for that weekday directly (the admin typed them,
-- there's no per-employee tally). Employee-managed mode tallies each
-- employee's effective choice: their daily override if one exists
-- (including an override of NULL, meaning "cancelled that day" — checked
-- via presence of the override row, not by coalescing on dish_id, since a
-- real NULL dish_id must not silently fall back to the standing choice),
-- else their standing weekly choice.
create or replace function engine.recompute_daily_heads(p_daily_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_daily public.daily_orders;
  v_order public.orders;
  v_weekday public.weekday;
  v_admin_managed boolean;
  v_total int;
begin
  select * into v_daily from public.daily_orders where id = p_daily_order_id;
  select * into v_order from public.orders where id = v_daily.order_id;
  select admin_managed_order into v_admin_managed from public.companies where id = v_order.company_id;
  v_weekday := engine.weekday_of(v_daily.order_date);

  delete from public.daily_order_dish_heads where daily_order_id = p_daily_order_id;

  if v_admin_managed then
    insert into public.daily_order_dish_heads (daily_order_id, dish_id, heads)
    select p_daily_order_id, odh.dish_id, odh.heads
    from public.order_dish_heads odh
    where odh.order_id = v_order.id and odh.weekday = v_weekday and odh.heads > 0;
  else
    insert into public.daily_order_dish_heads (daily_order_id, dish_id, heads)
    select p_daily_order_id, effective.dish_id, count(*)
    from (
      select
        case when dop.id is not null then dop.dish_id else udp.dish_id end as dish_id
      from public.user_dish_preferences udp
      left join public.daily_order_preferences dop
        on dop.daily_order_id = p_daily_order_id and dop.profile_id = udp.profile_id
      where udp.order_id = v_order.id and udp.weekday = v_weekday
      union all
      -- an override with no standing weekly preference at all (e.g. a new
      -- employee who hasn't set one yet) still counts.
      select dop.dish_id
      from public.daily_order_preferences dop
      where dop.daily_order_id = p_daily_order_id
        and not exists (
          select 1 from public.user_dish_preferences udp
          where udp.order_id = v_order.id and udp.profile_id = dop.profile_id and udp.weekday = v_weekday
        )
    ) effective(dish_id)
    where effective.dish_id is not null
    group by effective.dish_id;
  end if;

  select coalesce(sum(heads), 0) into v_total from public.daily_order_dish_heads where daily_order_id = p_daily_order_id;
  update public.daily_orders set total_heads = v_total where id = p_daily_order_id;
end;
$$;

-- Re-recomputes every still-`active` future daily order for one weekday —
-- called after a standing-order edit (admin heads or employee weekly
-- preference) so the change fans out immediately, same transaction, no
-- message queue (spec §5).
create or replace function engine.recompute_future_daily_heads_for_weekday(p_order_id uuid, p_weekday public.weekday)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select id from public.daily_orders
    where order_id = p_order_id and status = 'active'
      and extract(isodow from order_date)::int = engine.isodow_of_weekday(p_weekday)
  loop
    perform engine.recompute_daily_heads(r.id);
  end loop;
end;
$$;

-- Materializes a daily order on demand. Locked status is decided against
-- THAT SPECIFIC date's own cutoff, always (the §2 fix for legacy's
-- clock-driven locking bug) — never against "today" in general.
create or replace function engine.get_or_create_daily_order(p_order_id uuid, p_order_date date)
returns public.daily_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_row public.daily_orders;
  v_locked boolean;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'order % not found', p_order_id;
  end if;

  select * into v_row from public.daily_orders where order_id = p_order_id and order_date = p_order_date;
  if found then
    -- Lazily re-check on touch rather than trusting the stored status
    -- forever: a row materialized while still `active` needs to flip to
    -- `locked` once its own cutoff subsequently passes. This re-check is
    -- keyed on p_order_date (not "today"), so it doesn't reintroduce the
    -- §2 bug — it just means a cron sweep isn't required for correctness,
    -- only for pre-warming the vendor's view (engine.roll_orders).
    if v_row.status = 'active' and not engine.can_make_minor_update(v_order.company_id, v_order.module_id, p_order_date) then
      update public.daily_orders set status = 'locked' where id = v_row.id returning * into v_row;
    end if;
    return v_row;
  end if;

  v_locked := not engine.can_make_minor_update(v_order.company_id, v_order.module_id, p_order_date);

  insert into public.daily_orders (order_id, company_id, vendor_id, order_date, status, was_working_day)
  values (
    p_order_id, v_order.company_id, v_order.vendor_id, p_order_date,
    (case when v_locked then 'locked' else 'active' end)::public.daily_order_status,
    engine.is_working_day(v_order.company_id, p_order_date)
  )
  on conflict (order_id, order_date) do nothing
  returning * into v_row;

  if not found then -- lost a race to a concurrent materialization; use the winner's row
    select * into v_row from public.daily_orders where order_id = p_order_id and order_date = p_order_date;
  end if;

  perform engine.recompute_daily_heads(v_row.id);
  select * into v_row from public.daily_orders where id = v_row.id;
  return v_row;
end;
$$;

-- Pre-materializes the next N days for every active order, so a vendor's
-- headcount view doesn't wait on the first employee to touch a date —
-- parity with legacy's daily job, without its locking bug (§2). Plain
-- function, callable from pg_cron once the target instance's pg_cron
-- availability is confirmed; not scheduled by this migration.
create or replace function engine.roll_orders(p_days_ahead int default 14)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  d date;
begin
  for r in
    select id, from_date, to_date from public.orders
    where deleted_at is null and from_date <= current_date + p_days_ahead
      and (to_date is null or to_date >= current_date)
  loop
    for d in
      select generate_series(
        greatest(r.from_date, current_date),
        least(coalesce(r.to_date, current_date + p_days_ahead), current_date + p_days_ahead),
        interval '1 day'
      )::date
    loop
      perform engine.get_or_create_daily_order(r.id, d);
    end loop;
  end loop;
end;
$$;
