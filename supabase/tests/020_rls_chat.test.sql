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

select plan(20);

-- fixed ids from seed.sql
-- admin1 = a...0001, admin2 = a...0002
-- company1 admin (Cecilie) = a...0021, company2 admin (Casper) = a...0022
-- vendor1 admin (Vera) = a...0011
-- company1 = c...0001, company2 = c...0002, vendor1 = b...0001
-- seeded company_vendor room = e...0001

-- admin sees every admin_company / admin_vendor room, but not company_vendor
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'admin');
select is((select count(*)::int from public.chat_rooms where room_type = 'admin_company'), 2, 'admin sees both admin_company rooms');
select is((select count(*)::int from public.chat_rooms where room_type = 'admin_vendor'), 1, 'admin sees the admin_vendor room');
select is((select count(*)::int from public.chat_rooms where id = 'e0000000-0000-4000-8000-000000000001'), 0, 'admin is excluded from company_vendor rooms');

-- company_admin sees own company's admin room, not the other company's
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000021', 'company_admin', 'c0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.chat_rooms where room_type = 'admin_company'), 1, 'company_admin sees exactly own admin_company room');
select is((select count(*)::int from public.chat_rooms where room_type = 'admin_vendor'), 0, 'company_admin cannot see admin_vendor rooms');
select is((select count(*)::int from public.chat_rooms where id = 'e0000000-0000-4000-8000-000000000001'), 1, 'company_admin sees the company_vendor room it is party to');

-- vendor_admin sees own vendor's admin room and the shared company_vendor room
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000011', 'vendor_admin', null, 'b0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.chat_rooms where room_type = 'admin_vendor'), 1, 'vendor_admin sees exactly own admin_vendor room');
select is((select count(*)::int from public.chat_rooms where room_type = 'admin_company'), 0, 'vendor_admin cannot see admin_company rooms');
select is((select count(*)::int from public.chat_rooms where id = 'e0000000-0000-4000-8000-000000000001'), 1, 'vendor_admin sees the company_vendor room it is party to');

-- employee has no chat access at all (not company_admin/vendor_admin/admin)
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000101', 'employee', 'c0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.chat_rooms), 0, 'employee sees no chat rooms whatsoever');

-- send_chat_message: membership-checked
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000021', 'company_admin', 'c0000000-0000-4000-8000-000000000001');
select lives_ok(
  $$select api.send_chat_message('e0000000-0000-4000-8000-000000000001', 'test message from company')$$,
  'company_admin can send into a company_vendor room it belongs to'
);

reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000022', 'company_admin', 'c0000000-0000-4000-8000-000000000002');
select throws_ok(
  $$select api.send_chat_message('e0000000-0000-4000-8000-000000000001', 'sneaky')$$,
  'not a member of this chat room',
  'a different company cannot send into a room it is not party to'
);

-- unread increments for the other party, resets on mark_chat_room_read
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000011', 'vendor_admin', null, 'b0000000-0000-4000-8000-000000000001');
select ok(
  (select unread_count from public.chat_room_members
   where room_id = 'e0000000-0000-4000-8000-000000000001' and profile_id = 'a0000000-0000-4000-8000-000000000011') >= 1,
  'vendor received an unread bump from the company''s message'
);
select api.mark_chat_room_read('e0000000-0000-4000-8000-000000000001');
select is(
  (select unread_count from public.chat_room_members
   where room_id = 'e0000000-0000-4000-8000-000000000001' and profile_id = 'a0000000-0000-4000-8000-000000000011'),
  0, 'mark_chat_room_read resets the reader''s own unread count'
);

-- shared admin inbox: admin2 marks an admin_company room unread, admin1 sees it too
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002', 'admin');
select api.mark_chat_room_unread(
  (select id from public.chat_rooms where room_type = 'admin_company' and company_id = 'c0000000-0000-4000-8000-000000000001')
);
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'admin');
select ok(
  (select unread_count from public.chat_room_members
   where room_id = (select id from public.chat_rooms where room_type = 'admin_company' and company_id = 'c0000000-0000-4000-8000-000000000001')
     and profile_id = 'a0000000-0000-4000-8000-000000000001') >= 1,
  'admin1 sees the unread mark admin2 set (shared team inbox)'
);
select api.mark_chat_room_read(
  (select id from public.chat_rooms where room_type = 'admin_company' and company_id = 'c0000000-0000-4000-8000-000000000001')
);
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002', 'admin');
select is(
  (select unread_count from public.chat_room_members
   where room_id = (select id from public.chat_rooms where room_type = 'admin_company' and company_id = 'c0000000-0000-4000-8000-000000000001')
     and profile_id = 'a0000000-0000-4000-8000-000000000002'),
  0, 'admin1 reading the room clears it for admin2 too'
);

-- custom groups: admin-only to create
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000021', 'company_admin', 'c0000000-0000-4000-8000-000000000001');
select throws_ok(
  $$select api.create_custom_group('not allowed', array['a0000000-0000-4000-8000-000000000021']::uuid[])$$,
  'only admins can create custom groups'
);

reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'admin');
select lives_ok(
  $$select api.create_custom_group('Ops huddle', array['a0000000-0000-4000-8000-000000000021','a0000000-0000-4000-8000-000000000011']::uuid[])$$,
  'admin can create a custom group'
);
select is(
  (select count(*)::int from public.chat_room_members m
   join public.chat_rooms r on r.id = m.room_id
   where r.room_type = 'custom_group' and r.name = 'Ops huddle'),
  3, 'custom group has creator + the two explicit members, no other admins auto-injected'
);

-- anon: no table access at all
reset role;
select pg_temp.as_anon();
select throws_ok(
  $$select count(*) from public.chat_rooms$$,
  '42501', null, 'anon has no chat table access whatsoever'
);

select * from finish();
rollback;
