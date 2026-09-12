-- Domain: chat — 0001 Schema
-- See docs/specs/002-chat-domain.md for the full spec this implements.
--
-- Membership for admin_company / admin_vendor / company_vendor rooms is
-- DERIVED from role + company_id/vendor_id (app.chat_has_access below), not
-- stored — a company's admin room is automatically visible to every current
-- company_admin of that company and every admin, with no fan-out trigger
-- needed when staff changes. Only custom_group membership is stored
-- explicitly, since it isn't derivable from any other relationship.
-- chat_room_members still exists for all room types because unread/archived/
-- last_read_at are inherently per-person state, lazily upserted by the RPCs
-- the first time a profile touches a room.

create type public.chat_room_type as enum (
  'admin_company', 'admin_vendor', 'company_vendor', 'custom_group'
);

create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  room_type public.chat_room_type not null,
  company_id uuid references public.companies (id),
  vendor_id uuid references public.vendors (id),
  name text,
  created_by uuid references public.profiles (id),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_room_shape check (
    (room_type = 'admin_company' and company_id is not null and vendor_id is null)
    or (room_type = 'admin_vendor' and vendor_id is not null and company_id is null)
    or (room_type = 'company_vendor' and company_id is not null and vendor_id is not null)
    or (room_type = 'custom_group' and company_id is null and vendor_id is null)
  )
);
select app.add_updated_at('public.chat_rooms');

-- One admin room per company/vendor; one room per company-vendor pair.
create unique index chat_rooms_admin_company_uq on public.chat_rooms (company_id)
  where room_type = 'admin_company';
create unique index chat_rooms_admin_vendor_uq on public.chat_rooms (vendor_id)
  where room_type = 'admin_vendor';
create unique index chat_rooms_company_vendor_uq on public.chat_rooms (company_id, vendor_id)
  where room_type = 'company_vendor';
create index chat_rooms_last_message_idx on public.chat_rooms (last_message_at desc);

create table public.chat_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  unread_count int not null default 0,
  archived boolean not null default false,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (room_id, profile_id)
);
create index chat_room_members_profile_idx on public.chat_room_members (profile_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text,
  attachment_path text,
  attachment_name text,
  attachment_mime text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint chat_message_has_content check (body is not null or attachment_path is not null)
);
create index chat_messages_room_idx on public.chat_messages (room_id, created_at desc);

-- ---------------------------------------------------------------- access
-- The single source of truth for "can this caller see/use this room",
-- shared by RLS policies and every api.* RPC. Company-vendor rooms
-- deliberately exclude admins (matches legacy: admins don't see company<->
-- vendor conversations). admin_company/admin_vendor admit any admin (a
-- shared team inbox). custom_group access is explicit membership only —
-- no automatic admin bypass, so a group's roster is exactly who was added,
-- matching the fix described in docs/specs/002-chat-domain.md §3.
-- security definer (not just stable): it queries chat_rooms and
-- chat_room_members, both RLS-protected by policies that call this very
-- function — without definer rights the query would re-invoke the policy
-- on itself and recurse until the stack overflows.
create or replace function app.chat_has_access(p_room_id uuid)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.chat_rooms r
    where r.id = p_room_id
      and (
        (r.room_type = 'admin_company' and (
          app.role() = 'admin'
          or (app.role() = 'company_admin' and r.company_id = app.company_id())
        ))
        or (r.room_type = 'admin_vendor' and (
          app.role() = 'admin'
          or (app.role() = 'vendor_admin' and r.vendor_id = app.vendor_id())
        ))
        or (r.room_type = 'company_vendor' and (
          (app.role() = 'company_admin' and r.company_id = app.company_id())
          or (app.role() = 'vendor_admin' and r.vendor_id = app.vendor_id())
        ))
        or (r.room_type = 'custom_group' and exists (
          select 1 from public.chat_room_members m
          where m.room_id = r.id and m.profile_id = (select auth.uid())
        ))
      )
  )
$$;

-- For admin_company/admin_vendor/company_vendor, "who's in this room" is
-- derived (see app.chat_has_access) rather than stored, so a participant
-- who hasn't touched the room yet has no chat_room_members row to bump
-- unread on. This materializes rows for everyone currently eligible,
-- called before any write that needs to reach "the other members" (send,
-- mark read/unread). custom_group is skipped — its membership is only
-- ever the explicit set from create/update_custom_group.
create or replace function app.sync_chat_room_members(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.chat_rooms;
begin
  select * into v_room from public.chat_rooms where id = p_room_id;
  if not found or v_room.room_type = 'custom_group' then
    return;
  end if;

  insert into public.chat_room_members (room_id, profile_id)
  select p_room_id, pr.id
  from public.profiles pr
  where
    (v_room.room_type = 'admin_company' and (
      pr.role = 'admin' or (pr.role = 'company_admin' and pr.company_id = v_room.company_id)
    ))
    or (v_room.room_type = 'admin_vendor' and (
      pr.role = 'admin' or (pr.role = 'vendor_admin' and pr.vendor_id = v_room.vendor_id)
    ))
    or (v_room.room_type = 'company_vendor' and (
      (pr.role = 'company_admin' and pr.company_id = v_room.company_id)
      or (pr.role = 'vendor_admin' and pr.vendor_id = v_room.vendor_id)
    ))
  on conflict (room_id, profile_id) do nothing;
end;
$$;

-- ------------------------------------------------------------------- RLS
alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;
alter table public.chat_messages enable row level security;

-- No insert/update/delete policies anywhere in this domain: every write
-- goes through the api.* RPCs (security definer), which re-validate access
-- via app.chat_has_access() before touching a row. These SELECT policies
-- exist so Realtime (which reads through RLS, not through the RPCs) can
-- deliver row changes to the right subscribers.
create policy chat_rooms_read on public.chat_rooms for select to authenticated
  using (app.chat_has_access(id));

create policy chat_room_members_self_read on public.chat_room_members for select to authenticated
  using (profile_id = (select auth.uid()) or app.role() = 'admin');

create policy chat_messages_read on public.chat_messages for select to authenticated
  using (app.chat_has_access(room_id));

-- ------------------------------------------------------- room auto-create
-- A company/vendor's admin support room exists from the moment the org
-- does — no need to wait for a first message. Idempotent via the unique
-- partial indexes above.
create or replace function app.create_admin_company_room()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.chat_rooms (room_type, company_id)
  values ('admin_company', new.id)
  on conflict do nothing;
  return new;
end;
$$;
create trigger create_admin_company_room
after insert on public.companies
for each row execute function app.create_admin_company_room();

create or replace function app.create_admin_vendor_room()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.chat_rooms (room_type, vendor_id)
  values ('admin_vendor', new.id)
  on conflict do nothing;
  return new;
end;
$$;
create trigger create_admin_vendor_room
after insert on public.vendors
for each row execute function app.create_admin_vendor_room();

-- Domain 1's blanket app-schema execute grant only covered functions that
-- existed at the time; redo it for everything defined since, same as any
-- future domain will need to.
grant execute on all functions in schema app to authenticated, anon;
