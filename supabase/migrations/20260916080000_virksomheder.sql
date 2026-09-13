-- Domain: virksomheder — 0001 Settings write-paths + claims-enforcement fix
-- See docs/specs/008-virksomheder-domain.md. No new tables — every table
-- this domain writes to (company_working_days, public_holidays,
-- company_holidays, employee_absences, grace_periods) already exists from
-- the ordering domain, deliberately left SELECT-only "pending a future
-- settings screen." This is that screen's write-path.
--
-- Company/vendor/employee create-and-edit deliberately get NO new RPCs
-- here — domain 1's own RLS (`for all` for admin, `_own_update` for
-- company_admin/vendor_admin, `profiles_company_admin_all`) already
-- permits exactly the right direct writes; wrapping them in RPCs would
-- just duplicate what the database already enforces.

-- FIX: domain 1's claims-sync trigger never considered `status`, so
-- `profiles.status = 'inactive'` was pure decoration — nothing actually
-- revoked a deactivated user's access. This uses the exact mechanism
-- domain 1's own migration already documented ("a user with no wopla_role
-- claim matches no policy and is treated as unauthorised") rather than a
-- new one: null out the claims when status isn't active, so a
-- deactivated user matches no RLS policy on their next token refresh.
create or replace function app.sync_profile_claims()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_strip_nulls(
      jsonb_build_object(
        'wopla_role', new.role::text,
        'company_id', new.company_id::text,
        'vendor_id', new.vendor_id::text
      )
    )
    where id = new.id;
  else
    -- Explicit JSON nulls (not stripped) so ->>'wopla_role' etc. read back as
    -- SQL NULL — app.role() then matches no RLS policy, the same mechanism
    -- domain 1's own migration documented ("a user with no wopla_role claim
    -- matches no policy and is treated as unauthorised").
    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('wopla_role', null, 'company_id', null, 'vendor_id', null)
    where id = new.id;
  end if;
  return new;
end;
$$;

-- The trigger only ever watched role/company_id/vendor_id — deactivating
-- someone (an update of `status` alone) never fired it, so
-- profiles.status = 'inactive' was pure decoration. Re-create it to also
-- watch status.
drop trigger sync_profile_claims on public.profiles;
create trigger sync_profile_claims
after insert or update of role, company_id, vendor_id, status on public.profiles
for each row execute function app.sync_profile_claims();

-- ---------------------------------------------------------- working days
create or replace function api.set_company_working_days(
  p_company_id uuid, p_mon boolean, p_tue boolean, p_wed boolean, p_thu boolean,
  p_fri boolean, p_sat boolean, p_sun boolean
)
returns public.company_working_days
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.company_working_days;
begin
  if not (app.is_admin() or (app.role() = 'company_admin' and p_company_id = app.company_id())) then
    raise exception 'not allowed to set working days for this company';
  end if;

  insert into public.company_working_days (company_id, mon, tue, wed, thu, fri, sat, sun)
  values (p_company_id, p_mon, p_tue, p_wed, p_thu, p_fri, p_sat, p_sun)
  on conflict (company_id) do update set
    mon = excluded.mon, tue = excluded.tue, wed = excluded.wed, thu = excluded.thu,
    fri = excluded.fri, sat = excluded.sat, sun = excluded.sun
  returning * into v_row;

  return v_row;
end;
$$;

-- --------------------------------------------------------- public holidays
-- The shared calendar, not company-scoped — admin-only.
create or replace function api.create_public_holiday(p_name text, p_holiday_date date, p_module_id smallint default null)
returns public.public_holidays
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.public_holidays;
begin
  if not app.is_admin() then
    raise exception 'only admin can manage the public holiday calendar';
  end if;
  insert into public.public_holidays (name, holiday_date, module_id)
  values (p_name, p_holiday_date, p_module_id)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function api.delete_public_holiday(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'only admin can manage the public holiday calendar';
  end if;
  delete from public.public_holidays where id = p_id;
end;
$$;

-- -------------------------------------------------------- company holidays
create or replace function api.create_company_holiday(p_company_id uuid, p_holiday_date date, p_module_id smallint default null)
returns public.company_holidays
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.company_holidays;
begin
  if not (app.is_admin() or (app.role() = 'company_admin' and p_company_id = app.company_id())) then
    raise exception 'not allowed to set holidays for this company';
  end if;
  insert into public.company_holidays (company_id, holiday_date, module_id)
  values (p_company_id, p_holiday_date, p_module_id)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function api.delete_company_holiday(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from public.company_holidays where id = p_id;
  if not found then
    return;
  end if;
  if not (app.is_admin() or (app.role() = 'company_admin' and v_company_id = app.company_id())) then
    raise exception 'not allowed to remove holidays for this company';
  end if;
  delete from public.company_holidays where id = p_id;
end;
$$;

-- ------------------------------------------------------- employee absences
create or replace function api.create_employee_absence(p_profile_id uuid, p_absence_date date)
returns public.employee_absences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee_company_id uuid;
  v_row public.employee_absences;
begin
  select company_id into v_employee_company_id from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'employee not found';
  end if;
  if not (app.is_admin() or (app.role() = 'company_admin' and v_employee_company_id = app.company_id())) then
    raise exception 'not allowed to set absences for this employee';
  end if;

  insert into public.employee_absences (profile_id, absence_date)
  values (p_profile_id, p_absence_date)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function api.delete_employee_absence(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee_company_id uuid;
begin
  select p.company_id into v_employee_company_id
  from public.employee_absences ea join public.profiles p on p.id = ea.profile_id
  where ea.id = p_id;
  if not found then
    return;
  end if;
  if not (app.is_admin() or (app.role() = 'company_admin' and v_employee_company_id = app.company_id())) then
    raise exception 'not allowed to remove absences for this employee';
  end if;
  delete from public.employee_absences where id = p_id;
end;
$$;

-- ------------------------------------------------------------ grace periods
create or replace function api.set_grace_period(
  p_company_id uuid, p_module_id smallint,
  p_minor_update_days int, p_minor_update_time time,
  p_major_update_days int, p_major_update_time time,
  p_cancellation_days int, p_cancellation_time time,
  p_cancel_grace_period boolean, p_threshold int
)
returns public.grace_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.grace_periods;
begin
  if not (app.is_admin() or (app.role() = 'company_admin' and p_company_id = app.company_id())) then
    raise exception 'not allowed to set the grace period for this company';
  end if;

  insert into public.grace_periods (
    company_id, module_id, minor_update_days, minor_update_time,
    major_update_days, major_update_time, cancellation_days, cancellation_time,
    cancel_grace_period, threshold
  )
  values (
    p_company_id, p_module_id, p_minor_update_days, p_minor_update_time,
    p_major_update_days, p_major_update_time, p_cancellation_days, p_cancellation_time,
    p_cancel_grace_period, p_threshold
  )
  on conflict (company_id, module_id) do update set
    minor_update_days = excluded.minor_update_days, minor_update_time = excluded.minor_update_time,
    major_update_days = excluded.major_update_days, major_update_time = excluded.major_update_time,
    cancellation_days = excluded.cancellation_days, cancellation_time = excluded.cancellation_time,
    cancel_grace_period = excluded.cancel_grace_period, threshold = excluded.threshold
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on all functions in schema api to authenticated;
alter default privileges in schema api grant execute on functions to authenticated;
grant execute on all functions in schema app to authenticated, anon;
