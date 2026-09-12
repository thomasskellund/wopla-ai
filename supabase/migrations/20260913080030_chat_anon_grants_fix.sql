-- Domain: chat — 0004 Fix: anon inherited default grants on new tables
--
-- Supabase's own bootstrap sets up `alter default privileges ... grant all
-- on tables to anon, authenticated` for schema public. The 0003 grants
-- migration in the auth domain revoked anon's access on the tables that
-- existed *at that time* (companies/vendors/profiles), but never touched
-- the underlying default-privilege entry — so every table created since,
-- including all three chat tables, silently re-inherited full anon grants.
--
-- RLS still defends these tables in practice (every write is rejected with
-- "new row violates row-level security policy" since no policy admits
-- anon), but relying on that alone is fragile: a future policy bug would
-- have no grant-level backstop. This revokes anon's current grants on the
-- chat tables and removes the default-privilege entry so no future
-- domain's tables inherit it either.

revoke all on public.chat_rooms from anon;
revoke all on public.chat_room_members from anon;
revoke all on public.chat_messages from anon;

alter default privileges in schema public revoke all on tables from anon;
