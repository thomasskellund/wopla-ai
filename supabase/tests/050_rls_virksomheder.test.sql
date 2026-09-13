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

select plan(23);

-- ids from seed.sql: companyA = c...001, companyB = c...002
-- emma = a...101, erik = a...102 (companyA employees); cecilie = a...021 (companyA admin)

-- ------------------------------------------------------- working days
select pg_temp.as_user('a0000000-0000-4000-8000-000000000021', 'company_admin', 'c0000000-0000-4000-8000-000000000001');
select lives_ok(
  $$select api.set_company_working_days('c0000000-0000-4000-8000-000000000001', true, true, true, true, true, false, false)$$,
  'company_admin can set their own company''s working days'
);
select is(
  (select fri from public.company_working_days where company_id = 'c0000000-0000-4000-8000-000000000001'),
  true, 'working days upserted correctly'
);
select lives_ok(
  $$select api.set_company_working_days('c0000000-0000-4000-8000-000000000001', true, true, true, true, false, false, false)$$,
  'setting working days again upserts rather than duplicating'
);
select is(
  (select count(*)::int from public.company_working_days where company_id = 'c0000000-0000-4000-8000-000000000001'),
  1, 'still exactly one row after a second upsert'
);
select throws_ok(
  $$select api.set_company_working_days('c0000000-0000-4000-8000-000000000002', true, true, true, true, true, false, false)$$,
  'not allowed to set working days for this company'
);

-- ------------------------------------------------------------- holidays
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'admin');
select lives_ok(
  $$select api.create_public_holiday('Test Holiday', '2026-12-24', null)$$,
  'admin can create a public holiday'
);
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000021', 'company_admin', 'c0000000-0000-4000-8000-000000000001');
select throws_ok(
  $$select api.create_public_holiday('Sneaky Holiday', '2026-12-24', null)$$,
  'only admin can manage the public holiday calendar'
);
select lives_ok(
  $$select api.create_company_holiday('c0000000-0000-4000-8000-000000000001', '2026-10-01', null)$$,
  'company_admin can add a closure date for their own company'
);
select throws_ok(
  $$select api.create_company_holiday('c0000000-0000-4000-8000-000000000002', '2026-10-01', null)$$,
  'not allowed to set holidays for this company'
);
select lives_ok(
  $$select api.delete_company_holiday((select id from public.company_holidays where company_id = 'c0000000-0000-4000-8000-000000000001' limit 1))$$,
  'company_admin can remove their own company''s closure date'
);

-- ---------------------------------------------------- employee absences
select lives_ok(
  $$select api.create_employee_absence('a0000000-0000-4000-8000-000000000101', '2026-10-02')$$,
  'company_admin can record an absence for their own employee'
);
select throws_ok(
  $$select api.create_employee_absence('a0000000-0000-4000-8000-000000000201', '2026-10-02')$$,
  'not allowed to set absences for this employee'
);
select lives_ok(
  $$select api.delete_employee_absence((select id from public.employee_absences where profile_id = 'a0000000-0000-4000-8000-000000000101' limit 1))$$,
  'company_admin can remove their own employee''s absence'
);

-- -------------------------------------------------------------- grace period
select lives_ok(
  $$select api.set_grace_period('c0000000-0000-4000-8000-000000000001'::uuid, 1::smallint, 1, '10:00'::time, 5, '10:00'::time, 1, '10:00'::time, false, 3)$$,
  'company_admin can set their own company''s grace period'
);
select is(
  (select threshold from public.grace_periods where company_id = 'c0000000-0000-4000-8000-000000000001' and module_id = 1),
  3, 'grace period threshold saved correctly'
);
select lives_ok(
  $$select api.set_grace_period('c0000000-0000-4000-8000-000000000001'::uuid, 1::smallint, 1, '10:00'::time, 5, '10:00'::time, 1, '10:00'::time, false, 7)$$,
  'setting the grace period again upserts rather than duplicating'
);
select is(
  (select threshold from public.grace_periods where company_id = 'c0000000-0000-4000-8000-000000000001' and module_id = 1),
  7, 'second call''s threshold overwrote the first'
);
select throws_ok(
  $$select api.set_grace_period('c0000000-0000-4000-8000-000000000002'::uuid, 1::smallint, 1, '10:00'::time, 5, '10:00'::time, 1, '10:00'::time, false, 3)$$,
  'not allowed to set the grace period for this company'
);

-- ------------------------------------------------------------------ employee
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000101', 'employee', 'c0000000-0000-4000-8000-000000000001');
select throws_ok(
  $$select api.set_company_working_days('c0000000-0000-4000-8000-000000000001', true, true, true, true, true, false, false)$$,
  'not allowed to set working days for this company'
);

-- ---------------------------------------------------- claims enforcement fix
-- Reading auth.users needs the plain test-runner (superuser) role — it
-- isn't readable by `authenticated` at all (correctly). But `reset role`
-- alone doesn't clear `request.jwt.claims` (it's a separate GUC, still
-- local-to-transaction from the last as_user() call above), and the
-- UPDATE itself needs an admin claim to pass app.protect_company_columns
-- — so admin is set explicitly around the writes, and cleared again
-- (reset role) around the reads.
reset role;
select is(
  (select raw_app_meta_data ->> 'wopla_role' from auth.users where id = 'a0000000-0000-4000-8000-000000000102'),
  'employee', 'Erik''s claim starts out as employee (baseline before deactivation)'
);
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'admin');
update public.profiles set status = 'inactive' where id = 'a0000000-0000-4000-8000-000000000102';
reset role;
select is(
  (select raw_app_meta_data ->> 'wopla_role' from auth.users where id = 'a0000000-0000-4000-8000-000000000102'),
  null, 'deactivating a profile nulls out wopla_role in the JWT claims'
);
select is(
  (select raw_app_meta_data ->> 'company_id' from auth.users where id = 'a0000000-0000-4000-8000-000000000102'),
  null, 'deactivating a profile also nulls out company_id'
);
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'admin');
update public.profiles set status = 'active' where id = 'a0000000-0000-4000-8000-000000000102';
reset role;
select is(
  (select raw_app_meta_data ->> 'wopla_role' from auth.users where id = 'a0000000-0000-4000-8000-000000000102'),
  'employee', 'reactivating restores the claim'
);

select * from finish();
rollback;
