-- Impasto initial schema.
--
-- Design notes that the rest of the app depends on:
--
--  * Every quantity is `numeric`, never float. Accumulating a shopping list in
--    binary floating point drifts, and drifting grams are the one thing a
--    recipe app must not do.
--  * A recipe_items row references exactly one of an ingredient or a component
--    recipe, enforced by a check constraint rather than by convention.
--  * Catalog tables are shared when owner_id is null and private otherwise, so
--    the schema is multi-user ready while the first user sees a single library.
--  * Translations live in side tables keyed by locale. One canonical ingredient
--    and one formula; names and instructions are translated separately.

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type app_locale as enum ('ru', 'en', 'fr');

create type measure_kind as enum ('mass', 'volume', 'count', 'package', 'qualitative');

create type unit_code as enum (
  'mg', 'g', 'kg',
  'ml', 'l', 'tsp', 'tbsp',
  'piece', 'clove', 'leaf', 'bunch',
  'can', 'jar', 'bottle', 'pack', 'bag',
  'pinch', 'handful', 'to_taste', 'as_needed'
);

create type recipe_type as enum ('pizza', 'dough', 'sauce', 'prep');

create type recipe_status as enum ('draft', 'needs_review', 'verified', 'archived');

create type authenticity_class as enum (
  'traditional', 'pizzaiolo', 'modern_italian', 'adapted', 'experimental', 'user_verified'
);

create type pizza_shape as enum ('round', 'rectangular');

create type step_phase as enum (
  'preferment', 'mix', 'bulk', 'fold', 'ball', 'cold_proof',
  'warm_up', 'shape', 'bake', 'serve', 'prep', 'other'
);

create type source_type as enum (
  'user', 'youtube', 'official', 'website', 'photo', 'text', 'ai_assisted'
);

create type review_state as enum ('unreviewed', 'needs_review', 'confirmed', 'conflict');

create type storage_location as enum ('fridge', 'freezer', 'pantry');

create type package_type as enum ('can', 'jar', 'bottle', 'pack', 'bag');

create type substitution_grade as enum ('equivalent', 'good', 'acceptable', 'last_resort');

create type import_type as enum ('youtube', 'photo', 'text', 'manual');

create type import_status as enum ('pending', 'running', 'awaiting_review', 'approved', 'failed');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Normalizes text for accent- and case-insensitive search. Immutable so it can
-- back an index; `unaccent` is schema-qualified because the search_path is
-- pinned to empty for safety.
create or replace function normalize_search(input text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select lower(public.unaccent('public.unaccent', input));
$$;

-- ---------------------------------------------------------------------------
-- Identity and access
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  preferred_locale app_locale not null default 'ru',
  timezone text not null default 'UTC',
  temperature_unit text not null default 'c' check (temperature_unit in ('c', 'f')),
  default_diameter_mm integer not null default 300 check (default_diameter_mm > 0),
  default_ball_weight_g numeric(10, 2) not null default 250 check (default_ball_weight_g > 0),
  default_oven_profile_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_settings (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  app_name text,
  enabled_providers jsonb not null default '{}'::jsonb,
  recommendation_rules jsonb not null default '{}'::jsonb,
  preferred_shopping_units jsonb not null default '{}'::jsonb,
  include_experimental boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Server-side allowlist. ALLOWED_EMAILS covers the simple case; this table
-- exists so access can be managed without a redeploy.
create table access_allowlist (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catalog: categories, ingredients, aliases, packages, substitutions
-- ---------------------------------------------------------------------------

create table ingredient_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table ingredient_category_translations (
  category_id uuid not null references ingredient_categories (id) on delete cascade,
  locale app_locale not null,
  name text not null,
  primary key (category_id, locale)
);

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  -- null means the shared catalog; a uuid means one user's private ingredient.
  owner_id uuid references auth.users (id) on delete cascade,
  slug text not null,
  category_id uuid references ingredient_categories (id) on delete set null,
  parent_id uuid references ingredients (id) on delete set null,
  measure measure_kind not null,
  base_unit unit_code not null,
  -- g per ml, for this ingredient only. Null means volume<->mass is refused.
  density_g_per_ml numeric(10, 4) check (density_g_per_ml is null or density_g_per_ml > 0),
  allergens text[] not null default '{}',
  flags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Slugs are unique within a scope: once globally, and once per owner.
create unique index ingredients_global_slug_key
  on ingredients (slug) where owner_id is null;
create unique index ingredients_owner_slug_key
  on ingredients (owner_id, slug) where owner_id is not null;

create table ingredient_translations (
  ingredient_id uuid not null references ingredients (id) on delete cascade,
  locale app_locale not null,
  name text not null,
  plural_forms jsonb,
  description text,
  primary key (ingredient_id, locale)
);

create table ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients (id) on delete cascade,
  locale app_locale,
  alias text not null,
  normalized_alias text generated always as (normalize_search(alias)) stored
);

create index ingredient_aliases_normalized_idx
  on ingredient_aliases using gin (normalized_alias gin_trgm_ops);
create index ingredient_aliases_ingredient_idx on ingredient_aliases (ingredient_id);

create table ingredient_package_options (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  slug text not null,
  ingredient_id uuid not null references ingredients (id) on delete cascade,
  brand text,
  package_type package_type not null,
  net_quantity numeric(12, 4) not null check (net_quantity > 0),
  unit unit_code not null,
  barcode text,
  source_url text,
  preferred boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index package_options_global_slug_key
  on ingredient_package_options (slug) where owner_id is null;
create unique index package_options_owner_slug_key
  on ingredient_package_options (owner_id, slug) where owner_id is not null;
create index package_options_ingredient_idx on ingredient_package_options (ingredient_id);
create index package_options_barcode_idx on ingredient_package_options (barcode)
  where barcode is not null;

create table ingredient_package_option_translations (
  package_option_id uuid not null
    references ingredient_package_options (id) on delete cascade,
  locale app_locale not null,
  label text not null,
  primary key (package_option_id, locale)
);

create table styles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table style_translations (
  style_id uuid not null references styles (id) on delete cascade,
  locale app_locale not null,
  name text not null,
  description text,
  primary key (style_id, locale)
);

create table oven_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  slug text not null,
  max_temperature_c integer not null check (max_temperature_c > 0),
  created_at timestamptz not null default now()
);

create unique index oven_profiles_global_slug_key
  on oven_profiles (slug) where owner_id is null;
create unique index oven_profiles_owner_slug_key
  on oven_profiles (owner_id, slug) where owner_id is not null;

create table oven_profile_translations (
  oven_profile_id uuid not null references oven_profiles (id) on delete cascade,
  locale app_locale not null,
  name text not null,
  primary key (oven_profile_id, locale)
);

create table ingredient_substitutions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  from_ingredient_id uuid not null references ingredients (id) on delete cascade,
  to_ingredient_id uuid not null references ingredients (id) on delete cascade,
  style_id uuid references styles (id) on delete set null,
  quality_grade substitution_grade not null,
  -- Unapproved rows are kept so the UI can explain *why* a swap is refused.
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  constraint substitution_not_self check (from_ingredient_id <> to_ingredient_id)
);

create index substitutions_from_idx on ingredient_substitutions (from_ingredient_id);

create table ingredient_substitution_translations (
  substitution_id uuid not null
    references ingredient_substitutions (id) on delete cascade,
  locale app_locale not null,
  explanation text not null,
  primary key (substitution_id, locale)
);

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------

create table recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  slug text not null,
  type recipe_type not null,
  status recipe_status not null default 'draft',
  authenticity authenticity_class not null default 'user_verified',
  style_id uuid references styles (id) on delete set null,
  oven_profile_id uuid references oven_profiles (id) on delete set null,
  origin_locale app_locale not null default 'ru',
  base_yield numeric(12, 4) check (base_yield is null or base_yield > 0),
  yield_unit unit_code,
  base_diameter_mm integer check (base_diameter_mm is null or base_diameter_mm > 0),
  base_shape pizza_shape,
  base_tray_width_mm integer check (base_tray_width_mm is null or base_tray_width_mm > 0),
  base_tray_height_mm integer check (base_tray_height_mm is null or base_tray_height_mm > 0),
  base_ball_weight_g numeric(10, 2) check (base_ball_weight_g is null or base_ball_weight_g > 0),
  active_minutes integer check (active_minutes is null or active_minutes >= 0),
  passive_minutes integer check (passive_minutes is null or passive_minutes >= 0),
  difficulty smallint check (difficulty is null or difficulty between 1 and 5),
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  tags text[] not null default '{}',
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create index recipes_owner_idx on recipes (owner_id);
create index recipes_type_idx on recipes (owner_id, type);
create index recipes_status_idx on recipes (owner_id, status);

create table recipe_translations (
  recipe_id uuid not null references recipes (id) on delete cascade,
  locale app_locale not null,
  name text not null,
  summary text,
  notes text,
  serving_text text,
  primary key (recipe_id, locale)
);

create index recipe_translations_name_idx
  on recipe_translations using gin (normalize_search(name) gin_trgm_ops);

create table recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  ingredient_id uuid references ingredients (id) on delete restrict,
  component_recipe_id uuid references recipes (id) on delete restrict,
  -- Null amount with a null unit is an honest "unknown", not a zero.
  amount numeric(12, 4) check (amount is null or amount >= 0),
  amount_max numeric(12, 4) check (amount_max is null or amount_max >= 0),
  unit unit_code,
  optional boolean not null default false,
  item_group text,
  sort_order integer not null default 0,
  item_key text,
  created_at timestamptz not null default now(),

  -- A composition line is either an ingredient or a component, never both.
  constraint recipe_item_single_target check (
    (ingredient_id is not null and component_recipe_id is null)
    or (ingredient_id is null and component_recipe_id is not null)
  ),
  -- A recipe may not reference itself directly; deeper cycles are caught by
  -- the trigger below.
  constraint recipe_item_not_self check (component_recipe_id is distinct from recipe_id),
  constraint recipe_item_range_ordered check (
    amount_max is null or amount is null or amount_max >= amount
  )
);

create index recipe_items_recipe_idx on recipe_items (recipe_id, sort_order);
create index recipe_items_component_idx on recipe_items (component_recipe_id)
  where component_recipe_id is not null;

-- Rejects a component link that would close a loop, with a readable message.
-- The domain layer detects cycles too; this makes the invariant true of the
-- data itself rather than only of the code that reads it.
create or replace function assert_no_recipe_cycle()
returns trigger
language plpgsql
as $$
declare
  cycle_found boolean;
begin
  if new.component_recipe_id is null then
    return new;
  end if;

  with recursive descendants as (
    select new.component_recipe_id as id
    union
    select ri.component_recipe_id
    from recipe_items ri
    join descendants d on ri.recipe_id = d.id
    where ri.component_recipe_id is not null
  )
  select exists (select 1 from descendants where id = new.recipe_id)
  into cycle_found;

  if cycle_found then
    raise exception 'Recipe cycle: % cannot use % as a component', new.recipe_id, new.component_recipe_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger recipe_items_no_cycle
  before insert or update of component_recipe_id on recipe_items
  for each row execute function assert_no_recipe_cycle();

create table recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  step_key text,
  sort_order integer not null default 0,
  phase step_phase not null default 'other',
  active_minutes integer not null default 0 check (active_minutes >= 0),
  wait_min_minutes integer not null default 0 check (wait_min_minutes >= 0),
  wait_max_minutes integer not null default 0 check (wait_max_minutes >= 0),
  -- False when the source never stated a duration; drives the "approximate" badge.
  duration_known boolean not null default true,
  timer_seconds integer check (timer_seconds is null or timer_seconds > 0),
  temperature_c numeric(6, 2),
  anchor text check (anchor is null or anchor in ('serve_time', 'start_time')),
  created_at timestamptz not null default now(),
  constraint step_wait_ordered check (wait_max_minutes >= wait_min_minutes)
);

create index recipe_steps_recipe_idx on recipe_steps (recipe_id, sort_order);

create table recipe_step_translations (
  step_id uuid not null references recipe_steps (id) on delete cascade,
  locale app_locale not null,
  instruction text not null,
  sensory_cues text,
  troubleshooting text,
  primary key (step_id, locale)
);

create table recipe_step_items (
  step_id uuid not null references recipe_steps (id) on delete cascade,
  item_id uuid not null references recipe_items (id) on delete cascade,
  amount numeric(12, 4) check (amount is null or amount >= 0),
  unit unit_code,
  primary key (step_id, item_id)
);

create table recipe_media (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  storage_path text,
  external_url text,
  kind text not null default 'photo' check (kind in ('photo', 'thumbnail')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint media_has_location check (storage_path is not null or external_url is not null)
);

create table recipe_media_translations (
  media_id uuid not null references recipe_media (id) on delete cascade,
  locale app_locale not null,
  alt_text text not null,
  primary key (media_id, locale)
);

-- ---------------------------------------------------------------------------
-- Provenance: sources, timecodes, per-field evidence
-- ---------------------------------------------------------------------------

create table recipe_sources (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  source_type source_type not null,
  author text,
  title text,
  url text,
  published_at date,
  imported_at timestamptz not null default now(),
  attribution text,
  -- 0..1. Official specs and named professionals outrank anonymous posts.
  credibility_tier numeric(3, 2) not null default 0.5
    check (credibility_tier between 0 and 1)
);

create index recipe_sources_recipe_idx on recipe_sources (recipe_id);

create table source_timecodes (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references recipe_sources (id) on delete cascade,
  step_id uuid references recipe_steps (id) on delete cascade,
  start_seconds integer not null check (start_seconds >= 0),
  end_seconds integer check (end_seconds is null or end_seconds >= start_seconds)
);

-- Evidence is per *field*, which is what lets one disputed salt weight be
-- flagged without casting doubt on the whole recipe.
create table field_evidence (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null check (entity_type in ('recipe', 'recipe_item', 'recipe_step')),
  entity_id uuid not null,
  field text not null,
  source_id uuid references recipe_sources (id) on delete set null,
  timecode_id uuid references source_timecodes (id) on delete set null,
  confidence numeric(3, 2) not null default 0 check (confidence between 0 and 1),
  review_state review_state not null default 'unreviewed',
  -- Rows sharing a conflict_group are competing claims about the same field.
  conflict_group text,
  created_at timestamptz not null default now()
);

create index field_evidence_entity_idx on field_evidence (entity_type, entity_id);

create table field_evidence_translations (
  evidence_id uuid not null references field_evidence (id) on delete cascade,
  locale app_locale not null,
  note text not null,
  primary key (evidence_id, locale)
);

-- ---------------------------------------------------------------------------
-- Versions, cooking, experiments
-- ---------------------------------------------------------------------------

create table recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  version_number integer not null,
  -- Immutable snapshot of the recipe as published.
  snapshot jsonb not null,
  is_primary boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  unique (recipe_id, version_number)
);

create table cook_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references recipes (id) on delete cascade,
  version_id uuid references recipe_versions (id) on delete set null,
  scale_factor numeric(10, 4) not null default 1 check (scale_factor > 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rating smallint check (rating is null or rating between 1 and 5),
  notes text,
  outcome jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index cook_sessions_owner_idx on cook_sessions (owner_id, started_at desc);

create table cook_step_progress (
  session_id uuid not null references cook_sessions (id) on delete cascade,
  step_id uuid not null references recipe_steps (id) on delete cascade,
  completed_at timestamptz,
  timer_started_at timestamptz,
  timer_seconds integer,
  primary key (session_id, step_id)
);

create table cook_session_media (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references cook_sessions (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table recipe_experiments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references recipes (id) on delete cascade,
  version_ids uuid[] not null,
  changed_parameters jsonb not null default '{}'::jsonb,
  result text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Pantry and recognized products
-- ---------------------------------------------------------------------------

create table recognized_products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  barcode text,
  brand text,
  display_name text not null,
  net_quantity numeric(12, 4) check (net_quantity is null or net_quantity > 0),
  unit unit_code,
  ingredient_id uuid references ingredients (id) on delete set null,
  ocr_text text,
  nutrition jsonb,
  allergens text[],
  source text not null check (source in ('barcode', 'ocr', 'vision', 'manual')),
  confidence numeric(3, 2) check (confidence is null or confidence between 0 and 1),
  source_url text,
  -- Null unless the user explicitly asked to keep the original photo.
  image_storage_path text,
  created_at timestamptz not null default now()
);

create index recognized_products_barcode_idx on recognized_products (owner_id, barcode);

create table pantry_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id) on delete cascade,
  recognized_product_id uuid references recognized_products (id) on delete set null,
  quantity numeric(12, 4) check (quantity is null or quantity >= 0),
  unit unit_code,
  package_count numeric(10, 2) check (package_count is null or package_count >= 0),
  opened boolean not null default false,
  purchased_on date,
  expires_on date,
  location storage_location not null default 'pantry',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pantry_items_owner_idx on pantry_items (owner_id);
create index pantry_items_ingredient_idx on pantry_items (owner_id, ingredient_id);

-- ---------------------------------------------------------------------------
-- Planning and shopping
-- ---------------------------------------------------------------------------

create table meal_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  serve_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table meal_plan_recipes (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references meal_plans (id) on delete cascade,
  recipe_id uuid not null references recipes (id) on delete cascade,
  count integer not null default 1 check (count > 0),
  shape pizza_shape not null default 'round',
  diameter_mm integer check (diameter_mm is null or diameter_mm > 0),
  tray_width_mm integer check (tray_width_mm is null or tray_width_mm > 0),
  tray_height_mm integer check (tray_height_mm is null or tray_height_mm > 0),
  ball_weight_g numeric(10, 2) check (ball_weight_g is null or ball_weight_g > 0),
  scale_mode text not null default 'area' check (scale_mode in ('area', 'portion')),
  dough_recipe_id uuid references recipes (id) on delete set null,
  sauce_recipe_id uuid references recipes (id) on delete set null,
  sort_order integer not null default 0
);

create index meal_plan_recipes_plan_idx on meal_plan_recipes (meal_plan_id, sort_order);

create table shopping_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  meal_plan_id uuid references meal_plans (id) on delete set null,
  -- A snapshot for convenience; the plan and pantry remain the source of truth.
  generated_at timestamptz not null default now(),
  is_stale boolean not null default false,
  created_at timestamptz not null default now()
);

create table shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references shopping_lists (id) on delete cascade,
  ingredient_id uuid references ingredients (id) on delete set null,
  manual_name text,
  required_quantity numeric(12, 4),
  required_unit unit_code,
  pantry_quantity numeric(12, 4),
  to_buy_quantity numeric(12, 4),
  package_option_id uuid references ingredient_package_options (id) on delete set null,
  package_count integer check (package_count is null or package_count >= 0),
  leftover_quantity numeric(12, 4),
  checked boolean not null default false,
  category_id uuid references ingredient_categories (id) on delete set null,
  -- Which recipes contributed, for the "why is this here" drill-down.
  provenance jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  constraint shopping_item_has_subject check (
    ingredient_id is not null or manual_name is not null
  )
);

create index shopping_list_items_list_idx on shopping_list_items (shopping_list_id, sort_order);

-- ---------------------------------------------------------------------------
-- Imports
-- ---------------------------------------------------------------------------

create table import_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  type import_type not null,
  status import_status not null default 'pending',
  source_url text,
  source_storage_path text,
  provider text,
  -- Transient working data only. Cleared once structuring succeeds so that no
  -- full third-party transcript is retained.
  payload jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index import_jobs_owner_idx on import_jobs (owner_id, created_at desc);

create table import_candidates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references import_jobs (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- The structured extraction, pre-approval. Never becomes a recipe on its own.
  extraction jsonb not null,
  validation_issues jsonb not null default '[]'::jsonb,
  confidence numeric(3, 2) check (confidence is null or confidence between 0 and 1),
  approved_recipe_id uuid references recipes (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger user_settings_updated_at before update on user_settings
  for each row execute function set_updated_at();
create trigger ingredients_updated_at before update on ingredients
  for each row execute function set_updated_at();
create trigger recipes_updated_at before update on recipes
  for each row execute function set_updated_at();
create trigger pantry_items_updated_at before update on pantry_items
  for each row execute function set_updated_at();
create trigger meal_plans_updated_at before update on meal_plans
  for each row execute function set_updated_at();
