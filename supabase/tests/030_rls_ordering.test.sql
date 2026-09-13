begin;
create extension if not exists pgtap with schema extensions;
create or replace function pg_temp.as_user(uid uuid, r text, company uuid default null, vendor uuid default null)
returns void language plpgsql as $fn$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', uid::text, 'role', 'authenticated',
    'app_metadata', jsonb_strip_nulls(jsonb_build_object(
      'wopla_role', r, 'company_id', company::text, 'vendor_id', vendor::text))
  )::text, true);
  perform set_config('role', 'authenticated', true);
end; $fn$;
create or replace function pg_temp.as_anon() returns void language plpgsql as $fn$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end; $fn$;
-- Sets only the JWT claim (so app.role()/app.is_admin() read the faked
-- role) without switching the actual database role. `engine` has zero
-- grants at all — even `authenticated` can't reference it directly, only
-- security-definer app.*/api.* wrappers can — so testing engine.* functions
-- directly needs to stay on the superuser test-runner role.
create or replace function pg_temp.as_claims_only(uid uuid, r text, company uuid default null, vendor uuid default null)
returns void language plpgsql as $fn$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', uid::text, 'role', 'authenticated',
    'app_metadata', jsonb_strip_nulls(jsonb_build_object(
      'wopla_role', r, 'company_id', company::text, 'vendor_id', vendor::text))
  )::text, true);
end; $fn$;

select plan(24);

-- ids from seed.sql
-- companyA (employee-managed) = c...001, companyB (admin-managed) = c...002
-- vendor b...001; dishes d...001 (Lunch Buffet) / d...002 (Salad Bar)
-- order f...001 (companyA), f...002 (companyB)
-- emma = a...101, erik = a...102 (companyA employees); cecilie = a...021 (companyA admin)
-- casper = a...022 (companyB admin); vera = a...011 (vendor)

-- ---------------------------------------------------------------- admin
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'admin');
select is((select count(*)::int from public.orders), 2, 'admin sees all orders');
select is((select count(*)::int from public.dishes), 2, 'admin sees all dishes');
select is((select count(*)::int from public.daily_orders), (select count(*)::int from public.daily_orders), 'admin sees all daily orders (baseline)');
select isnt_empty($$select * from public.daily_orders$$, 'seed pre-materialized at least one daily order');

-- ---------------------------------------------------- company_admin (A, employee-managed)
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000021', 'company_admin', 'c0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.orders), 1, 'company_admin sees only its own order');
select is((select count(*)::int from public.orders where id = 'f0000000-0000-4000-8000-000000000002'), 0, 'company_admin cannot see the other company''s order');
select is(
  (select count(*)::int from public.user_dish_preferences where order_id = 'f0000000-0000-4000-8000-000000000001'),
  9, 'company_admin sees every employee''s standing preference row for its own company (account management)'
);
select throws_ok(
  $$update public.companies set admin_managed_order = true where id = 'c0000000-0000-4000-8000-000000000001'$$,
  'only admin can change admin_managed_order'
);

-- ------------------------------------------------------------------ employee
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000101', 'employee', 'c0000000-0000-4000-8000-000000000001');
select is(
  (select count(*)::int from public.user_dish_preferences where profile_id = 'a0000000-0000-4000-8000-000000000101'),
  5, 'employee sees own standing preference rows'
);
select is(
  (select count(*)::int from public.user_dish_preferences where profile_id = 'a0000000-0000-4000-8000-000000000102'),
  0, 'employee cannot see a co-worker''s standing preference rows'
);
select is((select count(*)::int from public.orders), 1, 'employee sees own company''s order');
select is((select count(*)::int from public.dishes), 2, 'employee sees the dishes of a vendor its company orders from');

-- ------------------------------------------------------- vendor_admin
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000011', 'vendor_admin', null, 'b0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.orders), 2, 'vendor sees both standing orders it serves');
select is((select count(*)::int from public.dishes where vendor_id = 'b0000000-0000-4000-8000-000000000001'), 2, 'vendor sees its own dishes');
select is(
  (select count(*)::int from public.user_dish_preferences),
  0, 'vendor cannot see individual employee preferences (aggregate-only view)'
);

-- ------------------------------------------------------------------- anon
reset role;
select pg_temp.as_anon();
select throws_ok($$select count(*) from public.orders$$, '42501', null, 'anon has no access to orders');
select throws_ok($$select count(*) from public.daily_orders$$, '42501', null, 'anon has no access to daily_orders');

-- --------------------------------------------------------- overlap constraint
-- Via the RPC, not a raw INSERT: there's no INSERT policy on orders at all
-- (every write goes through api.*, security definer bypasses RLS from
-- there) — a raw INSERT as any role, admin included, would hit an RLS
-- violation (42501) before ever reaching the exclusion constraint.
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'admin');
select throws_ok(
  $$select api.create_order('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', current_date, null)$$,
  '23P01', null, 'overlapping standing order for the same company+vendor+module is rejected'
);

-- ------------------------------------------------------------------- engine
-- Deliberately NOT the admin role here: engine.can_make_minor_update /
-- can_make_major_update short-circuit to `true` for admin (spec §1, "admin
-- bypasses every cutoff, on purpose") — testing the actual cutoff math
-- needs a non-admin caller, or the "outside the grace period" assertion
-- below would pass for the wrong reason (bypass, not real math) and its
-- mirror-image negative case would silently fail.
reset role;
select pg_temp.as_claims_only('a0000000-0000-4000-8000-000000000021', 'company_admin', 'c0000000-0000-4000-8000-000000000001');
select ok(engine.is_working_day(null::uuid, '2026-09-14'::date), 'Monday is a working day under the Mon-Fri default');
select ok(not engine.is_working_day(null::uuid, '2026-09-13'::date), 'Sunday is not a working day under the Mon-Fri default');
select is(engine.holiday_type(null::uuid, null::uuid, 1::smallint, '2026-12-25'::date), 'general', 'Christmas Day is recognized as a general holiday');
select ok(engine.can_make_minor_update(null::uuid, 1::smallint, current_date + 30), 'a date 30 days out is comfortably inside the minor grace period');
select ok(not engine.can_make_minor_update(null::uuid, 1::smallint, current_date - 30), 'a date 30 days in the past is outside the minor grace period');

-- ------------------------------------------------------------ set_my_daily_choice
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000101', 'employee', 'c0000000-0000-4000-8000-000000000001');
select lives_ok(
  $$select api.set_my_daily_choice('f0000000-0000-4000-8000-000000000001', current_date + 3, 'd0000000-0000-4000-8000-000000000002')$$,
  'employee can override their own future daily choice'
);

select * from finish();
rollback;
