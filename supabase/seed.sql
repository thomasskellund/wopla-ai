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
  ('c0000000-0000-4000-8000-000000000001', 'CompanyA', 'Amagertorv 1', 'København', '1160', 'DK22222222'),
  ('c0000000-0000-4000-8000-000000000002', 'CompanyB', 'Åboulevarden 5', 'Aarhus', '8000', 'DK33333333');

-- ---------------------------------------------------------------- users
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000001', 'admin@demo.wopla.dk', 'admin', 'Wopla Admin');
select pg_temp.seed_user('a0000000-0000-4000-8000-000000000002', 'admin2@demo.wopla.dk', 'admin', 'Second Admin');

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

-- ------------------------------------------------------------------- chat
-- admin_company / admin_vendor rooms already exist (created by triggers
-- when the companies/vendors above were inserted). Seed a few messages so
-- the chat UI has something to show.
insert into public.chat_messages (room_id, sender_id, body, created_at)
select id, 'a0000000-0000-4000-8000-000000000021', 'Hi, we have a question about switching our delivery days.', now() - interval '2 hours'
from public.chat_rooms where room_type = 'admin_company' and company_id = 'c0000000-0000-4000-8000-000000000001';
insert into public.chat_messages (room_id, sender_id, body, created_at)
select id, 'a0000000-0000-4000-8000-000000000001', 'Sure — which days would you like instead?', now() - interval '1 hour'
from public.chat_rooms where room_type = 'admin_company' and company_id = 'c0000000-0000-4000-8000-000000000001';

insert into public.chat_messages (room_id, sender_id, body, created_at)
select id, 'a0000000-0000-4000-8000-000000000011', 'We need to update our weekly menu for next month.', now() - interval '3 hours'
from public.chat_rooms where room_type = 'admin_vendor' and vendor_id = 'b0000000-0000-4000-8000-000000000001';

update public.chat_rooms set last_message_at = (
  select max(created_at) from public.chat_messages where chat_messages.room_id = chat_rooms.id
)
where exists (select 1 from public.chat_messages where chat_messages.room_id = chat_rooms.id);

-- one company-vendor room with a short exchange
insert into public.chat_rooms (id, room_type, company_id, vendor_id, created_by)
values (
  'e0000000-0000-4000-8000-000000000001', 'company_vendor',
  'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000021'
);
insert into public.chat_messages (room_id, sender_id, body, created_at) values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000021', 'Could we get an extra vegetarian option on Fridays?', now() - interval '30 minutes'),
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', 'Absolutely, I''ll add it from next week.', now() - interval '20 minutes');
update public.chat_rooms set last_message_at = now() - interval '20 minutes'
where id = 'e0000000-0000-4000-8000-000000000001';

-- give the recipients an unread badge to demo the inbox state
insert into public.chat_room_members (room_id, profile_id, unread_count)
select id, 'a0000000-0000-4000-8000-000000000021', 1
from public.chat_rooms where room_type = 'admin_company' and company_id = 'c0000000-0000-4000-8000-000000000001'
on conflict (room_id, profile_id) do update set unread_count = excluded.unread_count;
insert into public.chat_room_members (room_id, profile_id, unread_count)
values ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000021', 1)
on conflict (room_id, profile_id) do update set unread_count = excluded.unread_count;

commit;
