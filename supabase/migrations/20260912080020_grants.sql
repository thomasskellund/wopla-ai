-- Domain: auth & tenancy — 0003 Grants
-- `authenticated` gets blanket table grants; RLS policies are the actual
-- floor. `anon` gets none — every table requires a session.

grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

revoke all on all tables in schema public from anon;
