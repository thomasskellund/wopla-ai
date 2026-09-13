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
-- CompanyA is employee-managed (each employee picks their own lunch);
-- CompanyB is admin-managed (its company_admin types head counts
-- directly) — seeded so both ordering workflows are demoable out of the box.
insert into public.companies (id, name, address, city, zip, vat_number, admin_managed_order) values
  ('c0000000-0000-4000-8000-000000000001', 'CompanyA', 'Amagertorv 1', 'København', '1160', 'DK22222222', false),
  ('c0000000-0000-4000-8000-000000000002', 'CompanyB', 'Åboulevarden 5', 'Aarhus', '8000', 'DK33333333', true);

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

-- --------------------------------------------------------------- ordering
-- Dish names match what we found live on legacy's own demo vendor
-- ("Demo Vendor Kitchen") while researching the ordering domain.
insert into public.dishes (id, vendor_id, name) values
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Lunch Buffet'),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Salad Bar');

-- Dates are relative to seed-execution time, not hardcoded — a fixed past
-- date is exactly the trap that left legacy's own reference data stale
-- (see the ordering-domain retro in memory). Both orders started 30 days
-- ago and run open-ended.
insert into public.orders (id, company_id, vendor_id, module_id, from_date, to_date, created_by) values
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 1, current_date - 30, null, 'a0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 1, current_date - 30, null, 'a0000000-0000-4000-8000-000000000001');

-- CompanyA (employee-managed): Emma and Erik each set a standing weekly
-- choice; Erik skips Friday (no lunch that day) to show the "null means
-- no lunch" case for real.
insert into public.user_dish_preferences (order_id, profile_id, weekday, dish_id) values
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'mon', 'd0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'tue', 'd0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'wed', 'd0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'thu', 'd0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 'fri', 'd0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000102', 'mon', 'd0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000102', 'tue', 'd0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000102', 'wed', 'd0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000102', 'thu', 'd0000000-0000-4000-8000-000000000002');
select engine.recompute_standing_heads('f0000000-0000-4000-8000-000000000001', wd)
from unnest(enum_range(null::public.weekday)) as wd;

-- CompanyB (admin-managed): Casper (company_admin) typed these directly —
-- no per-employee preference rows exist for this order at all.
insert into public.order_dish_heads (order_id, dish_id, weekday, heads)
select 'f0000000-0000-4000-8000-000000000002', d.id, wd, h.heads
from (values
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'mon'::public.weekday, 15),
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'tue'::public.weekday, 15),
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'wed'::public.weekday, 12),
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'thu'::public.weekday, 15),
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'fri'::public.weekday, 10),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'mon'::public.weekday, 5),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'tue'::public.weekday, 5),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'wed'::public.weekday, 5),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'thu'::public.weekday, 5),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'fri'::public.weekday, 5)
) as h(dish_id, wd, heads)
join public.dishes d on d.id = h.dish_id;

-- Pre-materialize the next two weeks for both orders so the vendor/company
-- views have real data the moment anyone logs in — no "no active order"
-- empty state to greet a fresh reset with.
select engine.roll_orders(14);

-- ------------------------------------------------------------------ invoicing
-- One billing rate per demo order — the minimal contract stand-in.
-- CompanyA's vendor charges Wopla less per head than Wopla charges
-- CompanyA (the markup), plus a small kickback on the vendor side.
insert into public.billing_rates (order_id, vendor_per_head_price, company_per_head_price, kickback_percentage, from_date, to_date) values
  ('f0000000-0000-4000-8000-000000000001', 35.00, 45.00, 5.00, current_date - 30, null),
  ('f0000000-0000-4000-8000-000000000002', 32.00, 42.00, 5.00, current_date - 30, null);

-- Two real invoices (one per invoice type), generated the same way
-- api.create_invoice does, so there's a populated example for both
-- company_admin and vendor_admin the moment anyone logs in. Forward-
-- looking range: engine.roll_orders(14) above only pre-materializes
-- daily_orders from today onward, never backfilling past dates.
select api.create_invoice('wopla_to_customer'::public.invoice_type, 'c0000000-0000-4000-8000-000000000001'::uuid, current_date, current_date + 14, 1::smallint);
select api.create_invoice('vendor_to_wopla'::public.invoice_type, 'b0000000-0000-4000-8000-000000000001'::uuid, current_date, current_date + 14, 1::smallint);

-- give the recipients an unread badge to demo the inbox state
insert into public.chat_room_members (room_id, profile_id, unread_count)
select id, 'a0000000-0000-4000-8000-000000000021', 1
from public.chat_rooms where room_type = 'admin_company' and company_id = 'c0000000-0000-4000-8000-000000000001'
on conflict (room_id, profile_id) do update set unread_count = excluded.unread_count;
insert into public.chat_room_members (room_id, profile_id, unread_count)
values ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000021', 1)
on conflict (room_id, profile_id) do update set unread_count = excluded.unread_count;

commit;
