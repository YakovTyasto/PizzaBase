-- Row Level Security for every table.
--
-- Two shapes are used:
--
--  1. Owner-scoped: a row belongs to exactly one user and only that user may
--     read or write it.
--  2. Shared catalog: rows with a null owner_id are readable by any signed-in
--     user and writable by none of them (the service role seeds those), while
--     rows with an owner_id behave like case 1. This keeps one shared
--     ingredient catalog while leaving the schema multi-user ready.
--
-- Child tables are guarded through their parent, so a translation row is only
-- reachable if its recipe is.
--
-- The application still checks ownership server-side. RLS is the backstop, not
-- the only line of defence.

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;

create policy profiles_select_own on profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter table user_settings enable row level security;

create policy user_settings_all_own on user_settings
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- The allowlist is consulted by the service role during sign-in only. No
-- policies are created, so RLS denies every request from anon/authenticated.
alter table access_allowlist enable row level security;

-- ---------------------------------------------------------------------------
-- Shared catalog
-- ---------------------------------------------------------------------------

alter table ingredient_categories enable row level security;
create policy categories_read on ingredient_categories
  for select to authenticated using (true);

alter table ingredient_category_translations enable row level security;
create policy category_translations_read on ingredient_category_translations
  for select to authenticated using (true);

alter table styles enable row level security;
create policy styles_read on styles for select to authenticated using (true);

alter table style_translations enable row level security;
create policy style_translations_read on style_translations
  for select to authenticated using (true);

alter table ingredients enable row level security;

create policy ingredients_read on ingredients
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
-- A user may only ever create ingredients owned by themselves; they cannot
-- insert into the shared catalog by passing owner_id = null.
create policy ingredients_insert_own on ingredients
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy ingredients_update_own on ingredients
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy ingredients_delete_own on ingredients
  for delete to authenticated using (owner_id = (select auth.uid()));

alter table ingredient_translations enable row level security;
create policy ingredient_translations_read on ingredient_translations
  for select to authenticated using (
    exists (
      select 1 from ingredients i
      where i.id = ingredient_id
        and (i.owner_id is null or i.owner_id = (select auth.uid()))
    )
  );
create policy ingredient_translations_write on ingredient_translations
  for all to authenticated
  using (
    exists (select 1 from ingredients i where i.id = ingredient_id and i.owner_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from ingredients i where i.id = ingredient_id and i.owner_id = (select auth.uid()))
  );

alter table ingredient_aliases enable row level security;
create policy ingredient_aliases_read on ingredient_aliases
  for select to authenticated using (
    exists (
      select 1 from ingredients i
      where i.id = ingredient_id
        and (i.owner_id is null or i.owner_id = (select auth.uid()))
    )
  );
create policy ingredient_aliases_write on ingredient_aliases
  for all to authenticated
  using (
    exists (select 1 from ingredients i where i.id = ingredient_id and i.owner_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from ingredients i where i.id = ingredient_id and i.owner_id = (select auth.uid()))
  );

alter table oven_profiles enable row level security;
create policy oven_profiles_read on oven_profiles
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy oven_profiles_write on oven_profiles
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

alter table oven_profile_translations enable row level security;
create policy oven_profile_translations_read on oven_profile_translations
  for select to authenticated using (
    exists (
      select 1 from oven_profiles o
      where o.id = oven_profile_id
        and (o.owner_id is null or o.owner_id = (select auth.uid()))
    )
  );

alter table ingredient_package_options enable row level security;
create policy package_options_read on ingredient_package_options
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy package_options_write on ingredient_package_options
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

alter table ingredient_package_option_translations enable row level security;
create policy package_option_translations_read on ingredient_package_option_translations
  for select to authenticated using (
    exists (
      select 1 from ingredient_package_options p
      where p.id = package_option_id
        and (p.owner_id is null or p.owner_id = (select auth.uid()))
    )
  );

alter table ingredient_substitutions enable row level security;
create policy substitutions_read on ingredient_substitutions
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy substitutions_write on ingredient_substitutions
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

alter table ingredient_substitution_translations enable row level security;
create policy substitution_translations_read on ingredient_substitution_translations
  for select to authenticated using (
    exists (
      select 1 from ingredient_substitutions s
      where s.id = substitution_id
        and (s.owner_id is null or s.owner_id = (select auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- Recipes and their children
-- ---------------------------------------------------------------------------

alter table recipes enable row level security;
create policy recipes_all_own on recipes
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- One helper condition, applied to every recipe child table.
create or replace function owns_recipe(target uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.recipes r
    where r.id = target and r.owner_id = (select auth.uid())
  );
$$;

alter table recipe_translations enable row level security;
create policy recipe_translations_own on recipe_translations
  for all to authenticated
  using (owns_recipe(recipe_id)) with check (owns_recipe(recipe_id));

alter table recipe_items enable row level security;
create policy recipe_items_own on recipe_items
  for all to authenticated
  using (owns_recipe(recipe_id)) with check (owns_recipe(recipe_id));

alter table recipe_steps enable row level security;
create policy recipe_steps_own on recipe_steps
  for all to authenticated
  using (owns_recipe(recipe_id)) with check (owns_recipe(recipe_id));

alter table recipe_step_translations enable row level security;
create policy recipe_step_translations_own on recipe_step_translations
  for all to authenticated
  using (
    exists (select 1 from recipe_steps s where s.id = step_id and owns_recipe(s.recipe_id))
  )
  with check (
    exists (select 1 from recipe_steps s where s.id = step_id and owns_recipe(s.recipe_id))
  );

alter table recipe_step_items enable row level security;
create policy recipe_step_items_own on recipe_step_items
  for all to authenticated
  using (
    exists (select 1 from recipe_steps s where s.id = step_id and owns_recipe(s.recipe_id))
  )
  with check (
    exists (select 1 from recipe_steps s where s.id = step_id and owns_recipe(s.recipe_id))
  );

alter table recipe_media enable row level security;
create policy recipe_media_own on recipe_media
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

alter table recipe_media_translations enable row level security;
create policy recipe_media_translations_own on recipe_media_translations
  for all to authenticated
  using (
    exists (select 1 from recipe_media m where m.id = media_id and m.owner_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from recipe_media m where m.id = media_id and m.owner_id = (select auth.uid()))
  );

alter table recipe_sources enable row level security;
create policy recipe_sources_own on recipe_sources
  for all to authenticated
  using (owns_recipe(recipe_id)) with check (owns_recipe(recipe_id));

alter table source_timecodes enable row level security;
create policy source_timecodes_own on source_timecodes
  for all to authenticated
  using (
    exists (select 1 from recipe_sources s where s.id = source_id and owns_recipe(s.recipe_id))
  )
  with check (
    exists (select 1 from recipe_sources s where s.id = source_id and owns_recipe(s.recipe_id))
  );

alter table field_evidence enable row level security;
create policy field_evidence_own on field_evidence
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

alter table field_evidence_translations enable row level security;
create policy field_evidence_translations_own on field_evidence_translations
  for all to authenticated
  using (
    exists (select 1 from field_evidence e where e.id = evidence_id and e.owner_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from field_evidence e where e.id = evidence_id and e.owner_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Versions, cooking, pantry, planning, imports
-- ---------------------------------------------------------------------------

alter table recipe_versions enable row level security;
create policy recipe_versions_own on recipe_versions
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

alter table cook_sessions enable row level security;
create policy cook_sessions_own on cook_sessions
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

alter table cook_step_progress enable row level security;
create policy cook_step_progress_own on cook_step_progress
  for all to authenticated
  using (
    exists (select 1 from cook_sessions c where c.id = session_id and c.owner_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from cook_sessions c where c.id = session_id and c.owner_id = (select auth.uid()))
  );

alter table cook_session_media enable row level security;
create policy cook_session_media_own on cook_session_media
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

alter table recipe_experiments enable row level security;
create policy recipe_experiments_own on recipe_experiments
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

alter table recognized_products enable row level security;
create policy recognized_products_own on recognized_products
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

alter table pantry_items enable row level security;
create policy pantry_items_own on pantry_items
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

alter table meal_plans enable row level security;
create policy meal_plans_own on meal_plans
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

alter table meal_plan_recipes enable row level security;
create policy meal_plan_recipes_own on meal_plan_recipes
  for all to authenticated
  using (
    exists (select 1 from meal_plans p where p.id = meal_plan_id and p.owner_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from meal_plans p where p.id = meal_plan_id and p.owner_id = (select auth.uid()))
  );

alter table shopping_lists enable row level security;
create policy shopping_lists_own on shopping_lists
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

alter table shopping_list_items enable row level security;
create policy shopping_list_items_own on shopping_list_items
  for all to authenticated
  using (
    exists (select 1 from shopping_lists l where l.id = shopping_list_id and l.owner_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from shopping_lists l where l.id = shopping_list_id and l.owner_id = (select auth.uid()))
  );

alter table import_jobs enable row level security;
create policy import_jobs_own on import_jobs
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

alter table import_candidates enable row level security;
create policy import_candidates_own on import_candidates
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-media',
  'recipe-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'scan-uploads',
  'scan-uploads',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic']
)
on conflict (id) do nothing;

-- Objects are namespaced by user id: `<uid>/<filename>`. There is no public
-- write path into either bucket.
create policy recipe_media_read_own on storage.objects
  for select to authenticated
  using (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy recipe_media_write_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy recipe_media_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy scan_uploads_read_own on storage.objects
  for select to authenticated
  using (bucket_id = 'scan-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy scan_uploads_write_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'scan-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy scan_uploads_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'scan-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
