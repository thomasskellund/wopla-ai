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

select plan(11);

-- ids from seed.sql: admin = a...001; emma = a...101 (companyA employee)

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'admin');
select lives_ok(
  $$select api.create_announcement('Kitchen closed Friday', 'Grøn Kantine is closed for maintenance this Friday.')$$,
  'admin can post an announcement'
);
select is(
  (select title from public.announcements where title = 'Kitchen closed Friday'),
  'Kitchen closed Friday', 'the announcement row was inserted'
);

reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000101', 'employee', 'c0000000-0000-4000-8000-000000000001');
select is(
  (select is_read from api.list_announcements() where title = 'Kitchen closed Friday'),
  false, 'an unread announcement starts out unread for this employee'
);
select lives_ok(
  $$select api.mark_announcement_read((select id from public.announcements where title = 'Kitchen closed Friday'))$$,
  'employee can mark an announcement read'
);
select is(
  (select is_read from api.list_announcements() where title = 'Kitchen closed Friday'),
  true, 'marking it read flips is_read for that employee'
);
select throws_ok(
  $$select api.create_announcement('Sneaky post', 'not allowed')$$,
  'only admin can post announcements'
);

reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'admin');
select lives_ok(
  $$select api.create_announcement('Already expired', 'should never be visible', now() - interval '1 day')$$,
  'admin can post an already-expired announcement (edge case, not rejected)'
);

reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000101', 'employee', 'c0000000-0000-4000-8000-000000000001');
select is(
  (select count(*)::int from api.list_announcements() where title = 'Already expired'),
  0, 'an expired announcement is filtered out of the list'
);
select throws_ok(
  $$select api.delete_announcement((select id from public.announcements where title = 'Kitchen closed Friday'))$$,
  'only admin can delete announcements'
);

reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'admin');
select lives_ok(
  $$select api.delete_announcement((select id from public.announcements where title = 'Kitchen closed Friday'))$$,
  'admin can delete (soft-delete) an announcement'
);

reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000101', 'employee', 'c0000000-0000-4000-8000-000000000001');
select is(
  (select count(*)::int from api.list_announcements() where title = 'Kitchen closed Friday'),
  0, 'a deleted announcement no longer appears in the list'
);

select * from finish();
rollback;
