-- Deterministic demo data for the auth & tenancy domain.
-- All demo users share password 'wopla-demo-1234' (see @wopla/shared DEMO_PASSWORD).
-- Fixed UUID scheme: a… profiles/auth users, b… vendors, c… companies.
-- Runs after migrations on `supabase db reset`.

begin;

create or replace function pg_temp.seed_user(
  uid uuid,
  email text,
  wopla_role public.app_role,
  full_name text,
  company uuid default null,
  vendor uuid default null
)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    -- GoTrue scans these as strings; NULLs break sign-in ("Database error querying schema")
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    email, crypt('wopla-demo-1234', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(),
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), uid, uid::text,
    jsonb_build_object('sub', uid::text, 'email', email, 'email_verified', true),
    'email', now(), now(), now()
  );
  insert into public.profiles (id, role, company_id, vendor_id, full_name, language)
  values (uid, wopla_role, company, vendor, full_name, 'da');
end;
$$;

-- --------------------------------------------------------------- vendors
insert into public.vendors (id, name, address, city, zip, vat_number) values
  ('b0000000-0000-4000-8000-000000000001', 'Grøn Kantine', 'Vesterbrogade 10', 'København', '1620', 'DK11111111');

-- ------------------------------------------------------------- companies
insert into public.companies (id, name, address, city, zip, vat_number) values
  ('c0000000-0000-4000-8000-000000000001', 'Heyrobot ApS', 'Amagertorv 1', 'København', '1160', 'DK22222222'),
  ('c0000000-0000-4000-8000-000000000002', 'Nordisk Consulting', 'Åboulevarden 5', 'Aarhus', '8000', 'DK33333333');

-- ---------------------------------------------------------------- users
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000001', 'admin@demo.wopla.dk', 'admin', 'Admin Andersen');

select pg_temp.seed_user('a0000000-0000-4000-8000-000000000011', 'vendor1@demo.wopla.dk', 'vendor_admin', 'Vera Vendor',
  vendor => 'b0000000-0000-4000-8000-000000000001');

select pg_temp.seed_user('a0000000-0000-4000-8000-000000000021', 'companyadmin1@demo.wopla.dk', 'company_admin', 'Cecilie Companyadmin',
  company => 'c0000000-0000-4000-8000-000000000001');
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000022', 'companyadmin2@demo.wopla.dk', 'company_admin', 'Casper Companyadmin',
  company => 'c0000000-0000-4000-8000-000000000002');

select pg_temp.seed_user('a0000000-0000-4000-8000-000000000101', 'employee1@demo.wopla.dk', 'employee', 'Emma Employee',
  company => 'c0000000-0000-4000-8000-000000000001');
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000102', 'employee2@demo.wopla.dk', 'employee', 'Erik Employee',
  company => 'c0000000-0000-4000-8000-000000000001');
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000201', 'employee3@demo.wopla.dk', 'employee', 'Ella Employee',
  company => 'c0000000-0000-4000-8000-000000000002');

commit;
