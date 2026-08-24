-- What a signed-in owner can actually read.
--
-- The magic-link outage ended with an empty library, and the empty library was
-- not a bug: `/auth/callback` 404'd, so no session cookie was ever set, and RLS
-- did exactly what it should for a caller who is not signed in. That makes the
-- other half worth pinning down too -- that once a session *does* exist, the
-- seeded owner sees their catalog, and that a different signed-in user sees
-- none of it.
--
-- Run as the `authenticated` role rather than the superuser the rest of the
-- suite uses: RLS does not apply to a superuser, so checking these policies as
-- one would prove nothing at all.

\set ON_ERROR_STOP on

do $$
declare
  failures text[] := '{}';
begin
  if (select count(*) from recipes where owner_id = current_setting('request.jwt.claim.sub')::uuid) = 0 then
    failures := failures || 'the seeded owner has no recipes to read';
  end if;

  if array_length(failures, 1) is not null then
    raise exception 'RLS preconditions failed: %', array_to_string(failures, '; ');
  end if;
end
$$;

-- Everything below runs with policies enforced.
grant select on all tables in schema public to authenticated;
set role authenticated;

do $$
declare
  owner uuid := current_setting('request.jwt.claim.sub')::uuid;
  seeded integer;
  as_stranger integer;
  as_nobody integer;
  failures text[] := '{}';
begin
  -- The session a completed magic link produces: auth.uid() is the owner.
  select count(*) into seeded from recipes;
  if seeded = 0 then
    failures := failures || 'a signed-in owner sees no recipes through RLS';
  end if;

  -- Their own children come with them, which is what the library actually reads.
  if (select count(*) from recipe_translations) = 0 then
    failures := failures || 'a signed-in owner sees no recipe translations';
  end if;
  if (select count(*) from recipe_items) = 0 then
    failures := failures || 'a signed-in owner sees no recipe items';
  end if;

  -- A different signed-in user is a different tenant, and sees nothing of it.
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  select count(*) into as_stranger from recipes;
  if as_stranger <> 0 then
    failures := failures || format('another signed-in user can read %s recipes', as_stranger);
  end if;

  -- And no session at all reads nothing -- the state the broken callback left
  -- every visitor in, and the reason the library looked empty.
  perform set_config('request.jwt.claim.sub', '', true);
  select count(*) into as_nobody from recipes;
  if as_nobody <> 0 then
    failures := failures || format('a caller with no session can read %s recipes', as_nobody);
  end if;

  perform set_config('request.jwt.claim.sub', owner::text, true);

  if array_length(failures, 1) is not null then
    raise exception 'RLS session checks failed: %', array_to_string(failures, '; ');
  end if;

  raise notice '    a signed-in owner reads % recipes; a stranger and an anonymous caller read 0', seeded;
end
$$;

reset role;
