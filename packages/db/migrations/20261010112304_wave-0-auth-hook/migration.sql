-- The access-token hook. Supabase Auth calls it each time it issues a token and puts what it
-- returns into the token. It adds the claims the row-level-security policies read, so that Realtime
-- and Storage (which use the user's own token) are protected by the same policies as the API.
--
-- The API itself never trusts these claims: it reads a person's access from the database on every
-- request. So a mistake here can only make Realtime show less, never more.
--
-- Which membership: the one named in `app_metadata.membership_id` (set when a person with several
-- chooses one), else the person's only active membership. With none, or several and none chosen, no
-- organisation claims are added, and every policy then answers "no rows".
--
-- Capabilities for the sensitive tables are deliberately left out: those tables are never read
-- through Realtime, so a token never carries the right to.
--
-- The hook must never block a sign-in. Any failure returns the token unchanged.

create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  wanted text := claims -> 'app_metadata' ->> 'membership_id';
  found_id uuid;
  matches integer;
  m record;
  branches jsonb;
begin
  -- Claims from an earlier token must not survive a change of membership.
  claims := claims - 'org_id' - 'kind' - 'staff_id' - 'guardian_id' - 'family_id' - 'all_branches'
                   - 'branch_ids' - 'student_ids' - 'caps' - 'membership_id' - 'membership_version';

  select count(*), min(ms.id::text)::uuid
    into matches, found_id
  from public.memberships ms
  join public.orgs o on o.id = ms.org_id
  where ms.user_id = (event ->> 'user_id')::uuid
    and ms.deleted_at is null and ms.status = 'active'
    and o.deleted_at is null and o.status = 'active'
    and (wanted is null or wanted = '' or ms.id::text = wanted);

  if matches = 1 then
    select ms.id, ms.org_id, ms.kind, ms.staff_id, ms.guardian_id, ms.student_id, ms.all_branches, ms.token_version
      into m
    from public.memberships ms
    where ms.id = found_id;

    select coalesce(jsonb_agg(mb.branch_id), '[]'::jsonb)
      into branches
    from public.membership_branches mb
    where mb.membership_id = m.id and mb.deleted_at is null;

    claims := claims || jsonb_build_object(
      'org_id', m.org_id,
      'kind', m.kind,
      'membership_id', m.id,
      'membership_version', m.token_version,
      'all_branches', m.all_branches,
      'branch_ids', branches,
      -- A student sees their own records. A guardian's children are added by the students module's migration.
      'student_ids', case when m.student_id is null then '[]'::jsonb else jsonb_build_array(m.student_id) end,
      'caps', '[]'::jsonb
    );
    if m.staff_id is not null then
      claims := claims || jsonb_build_object('staff_id', m.staff_id);
    end if;
    if m.guardian_id is not null then
      claims := claims || jsonb_build_object('guardian_id', m.guardian_id);
    end if;
  end if;

  return jsonb_set(event, '{claims}', claims);
exception when others then
  return event;
end
$$;

-- Only the Auth service may call it.
revoke all on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;

do $$
begin
  if exists (select from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema public to supabase_auth_admin;
    grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
  end if;
end
$$;
