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

select plan(13);

-- admin sees everything
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'admin');
select is((select count(*)::int from public.companies), 2, 'admin sees all companies');
select is((select count(*)::int from public.vendors), 1, 'admin sees all vendors');

-- company_admin of company 1
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000021', 'company_admin', 'c0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.companies), 1, 'company_admin sees exactly own company');
select is((select count(*)::int from public.companies where id = 'c0000000-0000-4000-8000-000000000002'), 0, 'company_admin cannot see another company');
select is((select count(*)::int from public.profiles where company_id = 'c0000000-0000-4000-8000-000000000001'), 3, 'company_admin sees own staff (2 employees + self)');
select is((select count(*)::int from public.profiles where company_id = 'c0000000-0000-4000-8000-000000000002'), 0, 'company_admin cannot see other company staff');

-- vendor_admin of vendor 1
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000011', 'vendor_admin', null, 'b0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.vendors), 1, 'vendor_admin sees exactly own vendor');
select is((select count(*)::int from public.companies), 0, 'vendor cannot see any company yet (no orders relationship exists)');
select is((select count(*)::int from public.profiles where company_id is not null), 0, 'vendor cannot see company employees');

-- employee of company 1
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000101', 'employee', 'c0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.profiles where id = 'a0000000-0000-4000-8000-000000000101'), 1, 'employee reads own profile');
select is((select count(*)::int from public.companies), 1, 'employee reads own company');
select throws_ok(
  $$update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-000000000101'$$,
  'not allowed to change protected profile columns'
);

-- anon: no table grants at all — even SELECT is denied outright
reset role;
select pg_temp.as_anon();
select throws_ok(
  $$select count(*) from public.companies$$,
  '42501', null, 'anon has no table access whatsoever'
);

select * from finish();
rollback;
