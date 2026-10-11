-- First migration, written by hand. Everything after it is generated from the table files.
--
-- These functions read the signed-in user's token, which the API places in `request.jwt.claims`
-- at the start of every transaction (see `withUserTx`). The row-level security policies call them.
-- Supabase's own `auth.jwt()` reads the same setting, so Realtime and Storage see the same claims.

create schema if not exists app;

create or replace function app.claims() returns jsonb
language sql stable
as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

create or replace function app.org_id() returns uuid
language sql stable
as $$ select (app.claims() ->> 'org_id')::uuid $$;

create or replace function app.all_branches() returns boolean
language sql stable
as $$ select coalesce((app.claims() ->> 'all_branches')::boolean, false) $$;

create or replace function app.branch_ids() returns uuid[]
language sql stable
as $$ select coalesce(array(select jsonb_array_elements_text(app.claims() -> 'branch_ids')::uuid), '{}') $$;

grant usage on schema app to authenticated;
grant execute on all functions in schema app to authenticated;
