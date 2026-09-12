-- Domain: chat — 0002 API RPCs
-- Every function re-validates role/tenancy/membership itself via
-- app.chat_has_access(); none trust the caller's arguments. Parameters are
-- p_-prefixed throughout to avoid PL/pgSQL ambiguity against identically
-- named table columns (room_id, body, name, archived, ...).

-- Ensures a per-person state row exists before it's read/updated. Room
-- access must already have been checked by the caller.
create or replace function app.ensure_chat_room_member(p_room_id uuid, p_profile_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.chat_room_members (room_id, profile_id)
  values (p_room_id, p_profile_id)
  on conflict (room_id, profile_id) do nothing;
$$;

-- --------------------------------------------------------- list_chat_rooms
create or replace function api.list_chat_rooms(p_archived boolean default false, p_keyword text default null)
returns table (
  id uuid,
  room_type public.chat_room_type,
  company_id uuid,
  company_name text,
  vendor_id uuid,
  vendor_name text,
  name text,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count int,
  archived boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := (select auth.uid());
begin
  if v_profile_id is null then
    raise exception 'not authenticated';
  end if;

  return query
  select
    r.id,
    r.room_type,
    r.company_id,
    c.name as company_name,
    r.vendor_id,
    v.name as vendor_name,
    r.name,
    r.last_message_at,
    (
      select left(coalesce(m.body, '[attachment] ' || m.attachment_name), 140)
      from public.chat_messages m
      where m.room_id = r.id and m.deleted_at is null
      order by m.created_at desc
      limit 1
    ) as last_message_preview,
    coalesce(crm.unread_count, 0) as unread_count,
    coalesce(crm.archived, false) as archived
  from public.chat_rooms r
  left join public.companies c on c.id = r.company_id
  left join public.vendors v on v.id = r.vendor_id
  left join public.chat_room_members crm
    on crm.room_id = r.id and crm.profile_id = v_profile_id
  where app.chat_has_access(r.id)
    and coalesce(crm.archived, false) = p_archived
    and (
      p_keyword is null
      or c.name ilike '%' || p_keyword || '%'
      or v.name ilike '%' || p_keyword || '%'
      or r.name ilike '%' || p_keyword || '%'
      or exists (
        select 1 from public.chat_messages m
        where m.room_id = r.id and m.deleted_at is null and m.body ilike '%' || p_keyword || '%'
      )
    )
  order by r.last_message_at desc;
end;
$$;

-- ------------------------------------------------------- get_chat_messages
create or replace function api.get_chat_messages(p_room_id uuid, p_before timestamptz default null, p_limit int default 30)
returns table (
  id uuid,
  sender_id uuid,
  sender_name text,
  body text,
  attachment_path text,
  attachment_name text,
  attachment_mime text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.chat_has_access(p_room_id) then
    raise exception 'not a member of this chat room';
  end if;

  return query
  select m.id, m.sender_id, p.full_name, m.body, m.attachment_path, m.attachment_name, m.attachment_mime, m.created_at
  from public.chat_messages m
  join public.profiles p on p.id = m.sender_id
  where m.room_id = p_room_id
    and m.deleted_at is null
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc
  limit least(greatest(p_limit, 1), 100);
end;
$$;

-- ------------------------------------------------------- send_chat_message
create or replace function api.send_chat_message(
  p_room_id uuid,
  p_body text default null,
  p_attachment_path text default null,
  p_attachment_name text default null,
  p_attachment_mime text default null
)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := (select auth.uid());
  v_message public.chat_messages;
begin
  if v_profile_id is null then
    raise exception 'not authenticated';
  end if;
  if not app.chat_has_access(p_room_id) then
    raise exception 'not a member of this chat room';
  end if;
  if p_body is null and p_attachment_path is null then
    raise exception 'message must have a body or an attachment';
  end if;

  perform app.sync_chat_room_members(p_room_id);
  perform app.ensure_chat_room_member(p_room_id, v_profile_id);

  insert into public.chat_messages (room_id, sender_id, body, attachment_path, attachment_name, attachment_mime)
  values (p_room_id, v_profile_id, p_body, p_attachment_path, p_attachment_name, p_attachment_mime)
  returning * into v_message;

  update public.chat_rooms set last_message_at = v_message.created_at
  where id = p_room_id;

  -- Sender: un-archive, no unread bump. Everyone else who already has a
  -- state row: bump unread and un-archive (a new message brings the room
  -- back to the inbox for every participant, matching legacy intent).
  update public.chat_room_members
  set archived = false
  where room_id = p_room_id and profile_id = v_profile_id;

  update public.chat_room_members
  set unread_count = unread_count + 1, archived = false
  where room_id = p_room_id and profile_id <> v_profile_id;

  return v_message;
end;
$$;

-- --------------------------------------------------- mark_chat_room_read
create or replace function api.mark_chat_room_read(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := (select auth.uid());
  v_room_type public.chat_room_type;
begin
  if not app.chat_has_access(p_room_id) then
    raise exception 'not a member of this chat room';
  end if;
  perform app.sync_chat_room_members(p_room_id);
  perform app.ensure_chat_room_member(p_room_id, v_profile_id);

  select room_type into v_room_type from public.chat_rooms where id = p_room_id;

  if v_room_type in ('admin_company', 'admin_vendor') and app.role() = 'admin' then
    -- Shared team inbox: one admin reading it clears it for every admin.
    update public.chat_room_members m
    set unread_count = 0, last_read_at = now()
    from public.profiles p
    where m.room_id = p_room_id
      and m.profile_id = p.id
      and p.role = 'admin';
  else
    update public.chat_room_members
    set unread_count = 0, last_read_at = now()
    where room_id = p_room_id and profile_id = v_profile_id;
  end if;
end;
$$;

-- ------------------------------------------------- mark_chat_room_unread
create or replace function api.mark_chat_room_unread(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := (select auth.uid());
  v_room_type public.chat_room_type;
begin
  if not app.chat_has_access(p_room_id) then
    raise exception 'not a member of this chat room';
  end if;
  perform app.sync_chat_room_members(p_room_id);
  perform app.ensure_chat_room_member(p_room_id, v_profile_id);

  select room_type into v_room_type from public.chat_rooms where id = p_room_id;

  if v_room_type in ('admin_company', 'admin_vendor') and app.role() = 'admin' then
    update public.chat_room_members m
    set unread_count = greatest(unread_count, 1)
    from public.profiles p
    where m.room_id = p_room_id
      and m.profile_id = p.id
      and p.role = 'admin';
  else
    update public.chat_room_members
    set unread_count = greatest(unread_count, 1)
    where room_id = p_room_id and profile_id = v_profile_id;
  end if;
end;
$$;

-- ----------------------------------------------------- archive_chat_room
create or replace function api.archive_chat_room(p_room_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := (select auth.uid());
begin
  if not app.chat_has_access(p_room_id) then
    raise exception 'not a member of this chat room';
  end if;
  perform app.ensure_chat_room_member(p_room_id, v_profile_id);

  update public.chat_room_members
  set archived = p_archived
  where room_id = p_room_id and profile_id = v_profile_id;
end;
$$;

-- --------------------------------------------------- custom group RPCs
create or replace function api.create_custom_group(p_name text, p_member_profile_ids uuid[])
returns public.chat_rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := (select auth.uid());
  v_room public.chat_rooms;
begin
  if app.role() <> 'admin' then
    raise exception 'only admins can create custom groups';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'group name is required';
  end if;

  insert into public.chat_rooms (room_type, name, created_by)
  values ('custom_group', p_name, v_profile_id)
  returning * into v_room;

  insert into public.chat_room_members (room_id, profile_id)
  select v_room.id, m
  from unnest(array_append(coalesce(p_member_profile_ids, '{}'), v_profile_id)) as m
  on conflict (room_id, profile_id) do nothing;

  return v_room;
end;
$$;

create or replace function api.update_custom_group(p_room_id uuid, p_name text, p_member_profile_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := (select auth.uid());
  v_room_type public.chat_room_type;
  v_ids uuid[] := array_append(coalesce(p_member_profile_ids, '{}'), v_profile_id);
begin
  if app.role() <> 'admin' then
    raise exception 'only admins can edit custom groups';
  end if;
  select room_type into v_room_type from public.chat_rooms where id = p_room_id;
  if v_room_type is distinct from 'custom_group' then
    raise exception 'not a custom group';
  end if;

  update public.chat_rooms set name = p_name where id = p_room_id;

  delete from public.chat_room_members
  where room_id = p_room_id and profile_id <> all (v_ids);

  insert into public.chat_room_members (room_id, profile_id)
  select p_room_id, m from unnest(v_ids) as m
  on conflict (room_id, profile_id) do nothing;
end;
$$;

-- ------------------------------------------- get_or_create_company_vendor_room
-- Called by a company_admin with the vendor's id, or a vendor_admin with
-- the company's id — whichever side isn't the caller's own tenant.
create or replace function api.get_or_create_company_vendor_room(p_other_id uuid)
returns public.chat_rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_vendor_id uuid;
  v_room public.chat_rooms;
begin
  if app.role() = 'company_admin' then
    v_company_id := app.company_id();
    v_vendor_id := p_other_id;
  elsif app.role() = 'vendor_admin' then
    v_company_id := p_other_id;
    v_vendor_id := app.vendor_id();
  else
    raise exception 'only company_admin or vendor_admin can open a company-vendor chat';
  end if;

  select * into v_room from public.chat_rooms
  where room_type = 'company_vendor' and company_id = v_company_id and vendor_id = v_vendor_id;

  if not found then
    insert into public.chat_rooms (room_type, company_id, vendor_id, created_by)
    values ('company_vendor', v_company_id, v_vendor_id, (select auth.uid()))
    on conflict (company_id, vendor_id) where room_type = 'company_vendor' do nothing
    returning * into v_room;

    if v_room.id is null then
      select * into v_room from public.chat_rooms
      where room_type = 'company_vendor' and company_id = v_company_id and vendor_id = v_vendor_id;
    end if;
  end if;

  return v_room;
end;
$$;

grant execute on all functions in schema api to authenticated;
alter default privileges in schema api grant execute on functions to authenticated;
