-- Domain: auth & tenancy — 0001 Foundations
-- Extensions, the role enum, and the `app` / `api` schema shells.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums
create type public.app_role as enum ('admin', 'vendor_admin', 'company_admin', 'employee');
create type public.entity_status as enum ('active', 'inactive');

-- ------------------------------------------------- app schema (helpers)
-- Not exposed through the Data API; holds claim readers + shared trigger fns.
-- RLS policies call into this schema; it carries no table grants of its own.
create schema if not exists app;
grant usage on schema app to authenticated, anon;

-- Claims live in auth.users.raw_app_meta_data (user cannot edit it directly)
-- and are embedded in every JWT under `app_metadata` — no access-token hook
-- required. `profiles` is the source of truth; a trigger added in the
-- identity migration keeps raw_app_meta_data in sync. Claims therefore only
-- refresh on the next token refresh.
create or replace function app.jwt_app_meta()
returns jsonb
language sql stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata', '{}'::jsonb)
$$;

create or replace function app.role()
returns public.app_role
language sql stable
as $$
  select nullif(app.jwt_app_meta() ->> 'wopla_role', '')::public.app_role
$$;

create or replace function app.is_admin()
returns boolean
language sql stable
as $$
  select app.role() = 'admin'
$$;

create or replace function app.company_id()
returns uuid
language sql stable
as $$
  select nullif(app.jwt_app_meta() ->> 'company_id', '')::uuid
$$;

create or replace function app.vendor_id()
returns uuid
language sql stable
as $$
  select nullif(app.jwt_app_meta() ->> 'vendor_id', '')::uuid
$$;

grant execute on all functions in schema app to authenticated, anon;

-- updated_at maintenance
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Convenience: attach the standard updated_at trigger to a table.
create or replace function app.add_updated_at(target regclass)
returns void
language plpgsql
as $$
begin
  execute format(
    'create trigger touch_updated_at before update on %s for each row execute function app.touch_updated_at()',
    target
  );
end;
$$;

-- --------------------------------------------------------- api schema
-- The only RPC surface exposed through the Data API (see config.toml).
-- Empty for now — every function added here must be `security definer`
-- with `set search_path = ''` and re-validate role/tenancy explicitly.
create schema if not exists api;
grant usage on schema api to authenticated;
