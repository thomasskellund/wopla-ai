-- Domain: auth & tenancy — 0002 Identity
-- Companies, vendors, profiles, claims sync, and the RLS floor for all three.

-- ------------------------------------------------------------- companies
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  city text,
  zip text,
  vat_number text,
  status public.entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
select app.add_updated_at('public.companies');

-- --------------------------------------------------------------- vendors
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  city text,
  zip text,
  vat_number text,
  status public.entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
select app.add_updated_at('public.vendors');

-- -------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  company_id uuid references public.companies (id),
  vendor_id uuid references public.vendors (id),
  full_name text not null default '',
  phone text,
  language text not null default 'da' check (language in ('da', 'en')),
  status public.entity_status not null default 'active',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint role_tenant_shape check (
    (role = 'admin' and company_id is null and vendor_id is null)
    or (role = 'vendor_admin' and vendor_id is not null and company_id is null)
    or (role in ('company_admin', 'employee') and company_id is not null and vendor_id is null)
  )
);
select app.add_updated_at('public.profiles');
create index profiles_company_idx on public.profiles (company_id) where deleted_at is null;
create index profiles_vendor_idx on public.profiles (vendor_id) where deleted_at is null;

-- Sync role/tenant claims into auth metadata (source of truth: profiles).
create or replace function app.sync_profile_claims()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_strip_nulls(
    jsonb_build_object(
      'wopla_role', new.role::text,
      'company_id', new.company_id::text,
      'vendor_id', new.vendor_id::text
    )
  )
  where id = new.id;
  return new;
end;
$$;
revoke execute on function app.sync_profile_claims() from public, anon, authenticated;

create trigger sync_profile_claims
after insert or update of role, company_id, vendor_id on public.profiles
for each row execute function app.sync_profile_claims();

-- Column-level protection (a policy subquerying profiles would recurse):
-- non-admins can never change role/tenant/status columns, not even on their
-- own row. company_admin gets a narrow carve-out to manage its own staff.
create or replace function app.protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if app.is_admin() or (select auth.uid()) is null then
    return new; -- admins and service-role paths may change anything
  end if;
  if app.role() = 'company_admin'
    and old.id <> (select auth.uid())
    and old.company_id = app.company_id()
    and new.company_id = app.company_id()
    and new.role in ('company_admin', 'employee')
    and new.vendor_id is null then
    return new;
  end if;
  if new.role is distinct from old.role
    or new.company_id is distinct from old.company_id
    or new.vendor_id is distinct from old.vendor_id
    or new.status is distinct from old.status
    or new.deleted_at is distinct from old.deleted_at then
    raise exception 'not allowed to change protected profile columns';
  end if;
  return new;
end;
$$;
create trigger protect_profile_columns
before update on public.profiles
for each row execute function app.protect_profile_columns();

-- ------------------------------------------------------------------- RLS
alter table public.companies enable row level security;
alter table public.vendors enable row level security;
alter table public.profiles enable row level security;

-- companies
create policy companies_admin on public.companies for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
create policy companies_own_read on public.companies for select to authenticated
  using (deleted_at is null and id = app.company_id());
create policy companies_own_update on public.companies for update to authenticated
  using (app.role() = 'company_admin' and id = app.company_id() and deleted_at is null)
  with check (app.role() = 'company_admin' and id = app.company_id());
-- vendor visibility into the client companies it serves arrives with the
-- orders domain, once there is a table recording that relationship.

-- vendors
create policy vendors_admin on public.vendors for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
create policy vendors_own_read on public.vendors for select to authenticated
  using (deleted_at is null and id = app.vendor_id());
create policy vendors_own_update on public.vendors for update to authenticated
  using (app.role() = 'vendor_admin' and id = app.vendor_id() and deleted_at is null)
  with check (app.role() = 'vendor_admin' and id = app.vendor_id());

-- profiles
create policy profiles_admin on public.profiles for all to authenticated
  using (app.is_admin()) with check (app.is_admin());
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) and deleted_at is null)
  with check (id = (select auth.uid()));
create policy profiles_company_admin_all on public.profiles for all to authenticated
  using (
    app.role() = 'company_admin'
    and company_id = app.company_id()
    and deleted_at is null
  )
  with check (
    app.role() = 'company_admin'
    and company_id = app.company_id()
    and role in ('company_admin', 'employee')
  );
create policy profiles_vendor_staff_read on public.profiles for select to authenticated
  using (app.role() = 'vendor_admin' and vendor_id = app.vendor_id() and deleted_at is null);
create policy profiles_company_peers_read on public.profiles for select to authenticated
  using (
    app.role() = 'employee'
    and company_id = app.company_id()
    and deleted_at is null
  );
