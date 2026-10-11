-- Foundation. Written by hand; everything after it is generated from the table files.
-- It must run on Supabase's Postgres and on a plain Postgres (the in-process test database) alike,
-- so anything Supabase already provides is created only when it is missing.
--
-- Design: docs/plan/00-foundation/06-tenancy-roles-and-access.md and 07-backend-kernel.md.

-- ---------------------------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------------------------

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;     -- fast "contains" search on names
create extension if not exists btree_gist with schema extensions;  -- "no two rows overlap" constraints

-- ---------------------------------------------------------------------------------------------
-- 2. Roles
--
-- `authenticated` is the role every signed-in request runs as; the policies are written for it.
-- `takhti_api` is the role the application connects as. It owns nothing and inherits nothing, so a
-- query that forgot to go through `withUserTx` has no rights at all and fails loudly.
-- Its login and password are set by `pnpm db:reset` from the environment, never here.
-- ---------------------------------------------------------------------------------------------

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
  if not exists (select from pg_roles where rolname = 'takhti_api') then
    create role takhti_api nologin noinherit;
  end if;
end
$$;

grant authenticated to takhti_api with inherit false, set true;

-- Extension functions and operators live in the extensions schema.
alter role takhti_api set search_path = public, extensions;

-- ---------------------------------------------------------------------------------------------
-- 3. Who is asking
--
-- The API puts the signed-in user's claims in `request.jwt.claims` at the start of every
-- transaction. Supabase puts a real token's claims in the same setting, so Realtime and Storage
-- are protected by the same policies. A missing or empty value gives null or false everywhere:
-- no claims, no rows.
-- ---------------------------------------------------------------------------------------------

create schema if not exists app;

create or replace function app.claims() returns jsonb
language sql stable
set search_path = ''
as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

create or replace function app.org_id() returns uuid
language sql stable
set search_path = ''
as $$ select nullif(app.claims() ->> 'org_id', '')::uuid $$;

create or replace function app.user_id() returns uuid
language sql stable
set search_path = ''
as $$ select nullif(app.claims() ->> 'sub', '')::uuid $$;

create or replace function app.kind() returns text
language sql stable
set search_path = ''
as $$ select app.claims() ->> 'kind' $$;

create or replace function app.is_staff() returns boolean
language sql stable
set search_path = ''
as $$ select coalesce(app.claims() ->> 'kind' = 'staff', false) $$;

create or replace function app.all_branches() returns boolean
language sql stable
set search_path = ''
as $$ select coalesce((app.claims() ->> 'all_branches')::boolean, false) $$;

create or replace function app.uuid_list(key text) returns uuid[]
language sql stable
set search_path = ''
as $$
  select case
    when jsonb_typeof(app.claims() -> key) = 'array'
      then coalesce(array(select jsonb_array_elements_text(app.claims() -> key)::uuid), '{}'::uuid[])
    else '{}'::uuid[]
  end
$$;

create or replace function app.branch_ids() returns uuid[]
language sql stable
set search_path = ''
as $$ select app.uuid_list('branch_ids') $$;

create or replace function app.student_ids() returns uuid[]
language sql stable
set search_path = ''
as $$ select app.uuid_list('student_ids') $$;

create or replace function app.staff_id() returns uuid
language sql stable
set search_path = ''
as $$ select nullif(app.claims() ->> 'staff_id', '')::uuid $$;

create or replace function app.guardian_id() returns uuid
language sql stable
set search_path = ''
as $$ select nullif(app.claims() ->> 'guardian_id', '')::uuid $$;

create or replace function app.family_id() returns uuid
language sql stable
set search_path = ''
as $$ select nullif(app.claims() ->> 'family_id', '')::uuid $$;

-- Whether the user holds a capability for one of the sensitive tables: hr, payroll, health, counselling.
create or replace function app.has_cap(capability text) returns boolean
language sql stable
set search_path = ''
as $$
  select case
    when jsonb_typeof(app.claims() -> 'caps') = 'array' then (app.claims() -> 'caps') ? capability
    else false
  end
$$;

-- Today's date in Pakistan, whatever the server's time zone.
create or replace function app.today() returns date
language sql stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Karachi')::date $$;

-- ---------------------------------------------------------------------------------------------
-- 4. Triggers shared by every table
-- ---------------------------------------------------------------------------------------------

-- A safety net: the application sets `updated_at` itself, and this fills it in when an update forgot to.
create or replace function app.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end
$$;

-- Append-only tables: a row is never changed, and is removed only by the retention job,
-- which says so with `set local app.retention_purge = 'on'` on the privileged connection.
-- The trigger is attached as ALWAYS, so it also fires while a bulk load has ordinary triggers switched off.
create or replace function app.forbid_change() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('app.retention_purge', true), '') = 'on' then
    return old;
  end if;
  raise exception 'Rows of "%" are a permanent record and cannot be % ', tg_table_name,
    case tg_op when 'DELETE' then 'removed' else 'changed' end
    using errcode = 'TK001';
end
$$;

-- Brings the triggers of every table in `public` in line with the conventions. Run after every
-- migration by `applyMigrations`, with the append-only tables named by the table registry:
--   * a table with `updated_at` gets the safety-net trigger;
--   * a table in the list refuses update and delete; a table no longer in the list stops refusing;
--   * a table without row-level security stops the migration.
create or replace function app.sync_table_rules(append_only text[]) returns void
language plpgsql
set search_path = ''
as $$
declare
  t record;
begin
  for t in
    select c.oid, c.relname, c.relrowsecurity,
           exists (select from pg_catalog.pg_attribute a
                   where a.attrelid = c.oid and a.attname = 'updated_at' and not a.attisdropped) as has_updated_at,
           exists (select from pg_catalog.pg_trigger g
                   where g.tgrelid = c.oid and g.tgname = 'touch_updated_at') as has_touch,
           exists (select from pg_catalog.pg_trigger g
                   where g.tgrelid = c.oid and g.tgname = 'forbid_change') as has_forbid,
           exists (select from pg_catalog.pg_trigger g
                   where g.tgrelid = c.oid and g.tgname = 'forbid_change' and g.tgenabled = 'A') as forbid_always
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    if not t.relrowsecurity then
      raise exception 'Table "%" has row-level security switched off', t.relname;
    end if;

    if t.has_updated_at and not t.has_touch then
      execute format('create trigger touch_updated_at before update on public.%I for each row execute function app.touch_updated_at()', t.relname);
    end if;

    if t.relname = any (append_only) then
      if not t.has_forbid then
        execute format('create trigger forbid_change before update or delete on public.%I for each row execute function app.forbid_change()', t.relname);
      end if;
      if not t.forbid_always then
        execute format('alter table public.%I enable always trigger forbid_change', t.relname);
      end if;
    elsif t.has_forbid and not (t.relname = any (append_only)) then
      execute format('drop trigger forbid_change on public.%I', t.relname);
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Privileges
--
-- Signed-in users reach tables only as `authenticated`, and only for the four row operations;
-- row-level security then decides which rows. Nobody gets TRUNCATE, which row-level security
-- does not cover. Visitors who are not signed in (`anon`) get nothing in `public` at all:
-- public pages are served by the application, never by a direct database API.
-- ---------------------------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant usage on schema extensions to authenticated, takhti_api;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;

grant usage on schema app to authenticated;
revoke all on all functions in schema app from public;
grant execute on function
  app.claims(), app.org_id(), app.user_id(), app.kind(), app.is_staff(), app.all_branches(),
  app.uuid_list(text), app.branch_ids(), app.student_ids(), app.staff_id(), app.guardian_id(),
  app.family_id(), app.has_cap(text), app.today()
to authenticated, service_role;
alter default privileges in schema app revoke execute on functions from public;
