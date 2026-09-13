-- Domain: announcements — 0001 Admin broadcasts + per-user read state
-- The header's megaphone icon needs a real signal behind it: admin-authored
-- broadcasts, visible to every authenticated user, with a per-user
-- read/unread badge. Deliberately small — no categories, no scheduling,
-- no targeting by role/company/vendor.

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  deleted_at timestamptz
);

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, profile_id)
);

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

create policy announcements_admin on public.announcements for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
create policy announcements_read on public.announcements for select to authenticated
  using (deleted_at is null and (expires_at is null or expires_at > now()));

create policy announcement_reads_own on public.announcement_reads for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- ------------------------------------------------------------------- api
create or replace function api.create_announcement(p_title text, p_body text, p_expires_at timestamptz default null)
returns public.announcements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.announcements;
begin
  if not app.is_admin() then
    raise exception 'only admin can post announcements';
  end if;
  insert into public.announcements (title, body, created_by, expires_at)
  values (p_title, p_body, (select auth.uid()), p_expires_at)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function api.delete_announcement(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'only admin can delete announcements';
  end if;
  update public.announcements set deleted_at = now() where id = p_id;
end;
$$;

-- Returns every live announcement plus whether the caller has read it,
-- newest first, so the client doesn't need a second round trip.
create or replace function api.list_announcements()
returns table (
  id uuid, title text, body text, created_at timestamptz, expires_at timestamptz, is_read boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    a.id, a.title, a.body, a.created_at, a.expires_at,
    (r.profile_id is not null) as is_read
  from public.announcements a
  left join public.announcement_reads r
    on r.announcement_id = a.id and r.profile_id = (select auth.uid())
  where a.deleted_at is null and (a.expires_at is null or a.expires_at > now())
  order by a.created_at desc;
$$;

create or replace function api.mark_announcement_read(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.announcement_reads (announcement_id, profile_id)
  values (p_id, (select auth.uid()))
  on conflict (announcement_id, profile_id) do nothing;
end;
$$;

grant execute on all functions in schema api to authenticated;
alter default privileges in schema api grant execute on functions to authenticated;
