-- ---------------------------------------------------------------------------
-- Recipe photos, cook-session outcomes and experiments.
--
-- Everything here is additive: existing columns keep their meaning and the
-- earlier migrations are untouched, so a database created before this file can
-- take it without a rewrite.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Media
-- ---------------------------------------------------------------------------

alter table recipe_media
  add column if not exists is_cover boolean not null default false;

-- One cover per recipe. A partial unique index says that in the schema rather
-- than trusting every caller to remember.
create unique index if not exists recipe_media_one_cover_idx
  on recipe_media (recipe_id) where is_cover;

-- A photo taken during a cook belongs to the same private bucket and carries
-- the same alt text, so the two tables stay symmetrical.
alter table cook_session_media
  add column if not exists alt_text text,
  add column if not exists sort_order integer not null default 0;

-- Upload uses upsert, which needs UPDATE as well as INSERT. Without this an
-- overwrite fails with a policy violation that reads like a bug.
drop policy if exists recipe_media_update_own on storage.objects;
create policy recipe_media_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists scan_uploads_update_own on storage.objects;
create policy scan_uploads_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'scan-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'scan-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Narrow the buckets to what the app can actually decode. HEIC and AVIF were
-- listed optimistically; the client refuses them with an explanation, so
-- accepting them at the storage layer would only let a direct upload create a
-- file nothing can render.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'],
    file_size_limit = 2097152
where id in ('recipe-media', 'scan-uploads');

-- ---------------------------------------------------------------------------
-- Cook sessions
-- ---------------------------------------------------------------------------

-- The structured result of a cook. Kept as columns rather than inside the
-- existing `outcome` jsonb because these are compared across sessions, and a
-- comparison over jsonb keys is where typos go to hide.
alter table cook_sessions
  add column if not exists taste_rating smallint
    check (taste_rating is null or taste_rating between 1 and 5),
  add column if not exists crust_rating smallint
    check (crust_rating is null or crust_rating between 1 and 5),
  add column if not exists handling_rating smallint
    check (handling_rating is null or handling_rating between 1 and 5),
  add column if not exists actual_active_minutes integer
    check (actual_active_minutes is null or actual_active_minutes >= 0),
  add column if not exists actual_passive_minutes integer
    check (actual_passive_minutes is null or actual_passive_minutes >= 0),
  add column if not exists next_time text;

-- ---------------------------------------------------------------------------
-- Experiments
-- ---------------------------------------------------------------------------

alter table recipe_experiments
  add column if not exists hypothesis text,
  add column if not exists conclusion text,
  add column if not exists winning_version_id uuid references recipe_versions (id) on delete set null,
  add column if not exists session_ids uuid[] not null default '{}'::uuid[],
  add column if not exists title text;

alter table recipe_experiments enable row level security;

drop policy if exists recipe_experiments_own on recipe_experiments;
create policy recipe_experiments_own on recipe_experiments
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- save_recipe: photos join the same transaction
--
-- Media rows are replaced wholesale like items and steps, so removing a photo
-- in the editor removes it here. The *files* are a separate concern: the
-- application deletes orphaned objects from the bucket after the transaction
-- commits, because a storage delete cannot be rolled back with it.
-- ---------------------------------------------------------------------------

create or replace function save_recipe_media(p_recipe_id uuid, p_owner uuid, p_media jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
  v_media_id uuid;
  v_locale text;
  v_index integer := 0;
begin
  delete from recipe_media where recipe_id = p_recipe_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) loop
    -- A row with neither a stored object nor an external link would be a
    -- reference to nothing; the table's own constraint refuses it, and
    -- skipping here keeps the message about the recipe rather than the schema.
    continue when nullif(v_item ->> 'storagePath', '') is null
             and nullif(v_item ->> 'url', '') is null;

    insert into recipe_media (
      recipe_id, owner_id, storage_path, external_url, kind, sort_order, is_cover
    ) values (
      p_recipe_id,
      p_owner,
      nullif(v_item ->> 'storagePath', ''),
      nullif(v_item ->> 'url', ''),
      'photo',
      v_index,
      -- Only the first photo flagged as cover wins, so the partial unique
      -- index can never be violated by a careless caller.
      coalesce((v_item ->> 'isCover')::boolean, false) and v_index = coalesce(
        (select min(ordinality::integer) - 1
         from jsonb_array_elements(p_media) with ordinality e(value, ordinality)
         where coalesce((value ->> 'isCover')::boolean, false)),
        -1
      )
    )
    returning id into v_media_id;

    for v_locale in select unnest(array['ru', 'en', 'fr']) loop
      insert into recipe_media_translations (media_id, locale, alt_text)
      values (v_media_id, v_locale::app_locale, coalesce(nullif(v_item -> 'alt' ->> v_locale, ''), ''))
      on conflict (media_id, locale) do update set alt_text = excluded.alt_text;
    end loop;

    v_index := v_index + 1;
  end loop;
end;
$$;

comment on function save_recipe_media(uuid, uuid, jsonb) is
  'Replaces a recipe''s photo rows. Called inside save_recipe, so it shares its transaction.';

-- ---------------------------------------------------------------------------
-- save_recipe_with_media
--
-- Composition rather than duplication: `save_recipe` is unchanged and this
-- calls it, so both writes share one transaction and there is only ever one
-- copy of the recipe-writing logic to keep correct.
-- ---------------------------------------------------------------------------

create or replace function save_recipe_with_media(p_draft jsonb, p_create_version boolean default false)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
  v_owner uuid := auth.uid();
begin
  if v_owner is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;

  v_result := save_recipe(p_draft, p_create_version);
  perform save_recipe_media((v_result ->> 'recipeId')::uuid, v_owner, p_draft -> 'media');

  return v_result;
end;
$$;

comment on function save_recipe_with_media(jsonb, boolean) is
  'save_recipe plus the recipe''s photos, in a single transaction.';

-- ---------------------------------------------------------------------------
-- Storage paths a delete would orphan
--
-- The application asks for these *before* deleting the recipe, then removes
-- the objects afterwards: a storage delete cannot participate in the database
-- transaction, so the order has to be one that leaves no unreachable file.
-- ---------------------------------------------------------------------------

create or replace function recipe_storage_paths(p_slug text)
returns setof text
language sql
security invoker
set search_path = public
as $$
  select m.storage_path
  from recipe_media m
  join recipes r on r.id = m.recipe_id
  where r.slug = p_slug
    and r.owner_id = (select auth.uid())
    and m.storage_path is not null;
$$;
