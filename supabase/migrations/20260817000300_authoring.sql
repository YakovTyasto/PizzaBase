-- Recipe authoring: one transactional entry point, plus import idempotency.
--
-- Saving a recipe touches eight tables. Doing that as eight round trips from
-- the application would leave a half-written recipe behind whenever one of
-- them failed, so the whole write is a single function instead: PostgreSQL
-- wraps a function body in one transaction, and any exception rolls the lot
-- back.
--
-- The function is SECURITY INVOKER on purpose. It runs as the calling user, so
-- Row Level Security still applies to every statement inside it -- the RPC is
-- a convenience for atomicity, never a way around the access rules.

-- ---------------------------------------------------------------------------
-- Import idempotency
-- ---------------------------------------------------------------------------

create table approved_imports (
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- Derived from the candidate's content by the application, so pressing
  -- "Save" twice cannot produce two recipes.
  idempotency_key text not null,
  recipe_id uuid references recipes (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (owner_id, idempotency_key)
);

alter table approved_imports enable row level security;

create policy approved_imports_own on approved_imports
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Resolves an ingredient slug to an id visible to the caller: their own
-- ingredient first, otherwise the shared catalog entry.
create or replace function resolve_ingredient_id(p_slug text)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select id from public.ingredients
  where slug = p_slug
    and (owner_id = (select auth.uid()) or owner_id is null)
  order by owner_id nulls last
  limit 1;
$$;

create or replace function resolve_recipe_id(p_slug text)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select id from public.recipes
  where slug = p_slug and owner_id = (select auth.uid())
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- save_recipe
-- ---------------------------------------------------------------------------

create or replace function save_recipe(p_draft jsonb, p_create_version boolean default false)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := (select auth.uid());
  v_slug text := p_draft ->> 'slug';
  v_recipe_id uuid;
  v_existing recipes%rowtype;
  v_created boolean := false;
  v_versioned boolean := false;
  v_item jsonb;
  v_step jsonb;
  v_evidence jsonb;
  v_translation jsonb;
  v_locale text;
  v_step_id uuid;
  v_item_id uuid;
  v_source_id uuid;
  v_target_id uuid;
  v_evidence_id uuid;
  v_ingredient_id uuid;
  v_component_id uuid;
  v_item_key text;
  v_next_version integer;
begin
  if v_owner is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  if v_slug is null or v_slug = '' then
    raise exception 'A recipe slug is required' using errcode = 'check_violation';
  end if;

  select * into v_existing from recipes where slug = v_slug and owner_id = v_owner;

  -- Snapshot the recipe as it stands before overwriting it. A verified recipe
  -- is always versioned; anything else only when the caller asks.
  if found and (p_create_version or v_existing.status = 'verified') then
    select coalesce(max(version_number), 0) + 1 into v_next_version
    from recipe_versions where recipe_id = v_existing.id;

    insert into recipe_versions (recipe_id, owner_id, version_number, snapshot, note)
    values (
      v_existing.id,
      v_owner,
      v_next_version,
      jsonb_build_object(
        'recipe', to_jsonb(v_existing),
        'translations', (
          select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
          from recipe_translations t where t.recipe_id = v_existing.id
        ),
        'items', (
          select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
          from recipe_items i where i.recipe_id = v_existing.id
        ),
        'steps', (
          select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
          from recipe_steps s where s.recipe_id = v_existing.id
        ),
        'step_translations', (
          select coalesce(jsonb_agg(to_jsonb(st)), '[]'::jsonb)
          from recipe_step_translations st
          join recipe_steps s on s.id = st.step_id
          where s.recipe_id = v_existing.id
        )
      ),
      p_draft ->> 'versionNote'
    );
    v_versioned := true;
  end if;

  if found then
    v_recipe_id := v_existing.id;
    update recipes set
      type = (p_draft ->> 'type')::recipe_type,
      status = (p_draft ->> 'status')::recipe_status,
      authenticity = (p_draft ->> 'authenticity')::authenticity_class,
      style_id = (select id from styles where slug = p_draft ->> 'styleSlug'),
      oven_profile_id = (
        select id from oven_profiles
        where slug = p_draft ->> 'ovenProfileSlug'
          and (owner_id = v_owner or owner_id is null)
        order by owner_id nulls last limit 1
      ),
      origin_locale = (p_draft ->> 'originLocale')::app_locale,
      base_yield = nullif(p_draft ->> 'baseYield', '')::numeric,
      yield_unit = nullif(p_draft ->> 'yieldUnit', '')::unit_code,
      base_diameter_mm = nullif(p_draft ->> 'baseDiameterMm', '')::integer,
      base_shape = nullif(p_draft ->> 'baseShape', '')::pizza_shape,
      base_tray_width_mm = nullif(p_draft ->> 'baseTrayWidthMm', '')::integer,
      base_tray_height_mm = nullif(p_draft ->> 'baseTrayHeightMm', '')::integer,
      base_ball_weight_g = nullif(p_draft ->> 'baseBallWeightG', '')::numeric,
      active_minutes = nullif(p_draft ->> 'activeMinutes', '')::integer,
      passive_minutes = nullif(p_draft ->> 'passiveMinutes', '')::integer,
      difficulty = nullif(p_draft ->> 'difficulty', '')::smallint,
      tags = coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(p_draft -> 'tags')),
        '{}'
      )
    where id = v_recipe_id;
  else
    insert into recipes (
      owner_id, slug, type, status, authenticity, style_id, oven_profile_id,
      origin_locale, base_yield, yield_unit, base_diameter_mm, base_shape,
      base_tray_width_mm, base_tray_height_mm, base_ball_weight_g,
      active_minutes, passive_minutes, difficulty, tags
    ) values (
      v_owner,
      v_slug,
      (p_draft ->> 'type')::recipe_type,
      (p_draft ->> 'status')::recipe_status,
      (p_draft ->> 'authenticity')::authenticity_class,
      (select id from styles where slug = p_draft ->> 'styleSlug'),
      (
        select id from oven_profiles
        where slug = p_draft ->> 'ovenProfileSlug'
          and (owner_id = v_owner or owner_id is null)
        order by owner_id nulls last limit 1
      ),
      (p_draft ->> 'originLocale')::app_locale,
      nullif(p_draft ->> 'baseYield', '')::numeric,
      nullif(p_draft ->> 'yieldUnit', '')::unit_code,
      nullif(p_draft ->> 'baseDiameterMm', '')::integer,
      nullif(p_draft ->> 'baseShape', '')::pizza_shape,
      nullif(p_draft ->> 'baseTrayWidthMm', '')::integer,
      nullif(p_draft ->> 'baseTrayHeightMm', '')::integer,
      nullif(p_draft ->> 'baseBallWeightG', '')::numeric,
      nullif(p_draft ->> 'activeMinutes', '')::integer,
      nullif(p_draft ->> 'passiveMinutes', '')::integer,
      nullif(p_draft ->> 'difficulty', '')::smallint,
      coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(p_draft -> 'tags')),
        '{}'
      )
    )
    returning id into v_recipe_id;
    v_created := true;
  end if;

  -- Translations: upserted per locale, blanks stored as null so the fallback
  -- chain can do its job.
  for v_locale in select unnest(array['ru', 'en', 'fr']) loop
    insert into recipe_translations (recipe_id, locale, name, summary, notes)
    values (
      v_recipe_id,
      v_locale::app_locale,
      coalesce(nullif(p_draft -> 'names' ->> v_locale, ''), v_slug),
      nullif(p_draft -> 'summaries' ->> v_locale, ''),
      nullif(p_draft -> 'notes' ->> v_locale, '')
    )
    on conflict (recipe_id, locale) do update set
      name = excluded.name, summary = excluded.summary, notes = excluded.notes;
  end loop;

  -- Children are replaced wholesale: the editor always submits the complete
  -- recipe, and diffing rows would add complexity for no benefit.
  delete from recipe_steps where recipe_id = v_recipe_id;
  delete from recipe_items where recipe_id = v_recipe_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_draft -> 'items', '[]'::jsonb)) loop
    v_ingredient_id := null;
    v_component_id := null;

    if nullif(v_item ->> 'ingredientSlug', '') is not null then
      v_ingredient_id := resolve_ingredient_id(v_item ->> 'ingredientSlug');
      if v_ingredient_id is null then
        raise exception 'Unknown ingredient "%"', v_item ->> 'ingredientSlug'
          using errcode = 'foreign_key_violation';
      end if;
    elsif nullif(v_item ->> 'componentSlug', '') is not null then
      v_component_id := resolve_recipe_id(v_item ->> 'componentSlug');
      if v_component_id is null then
        raise exception 'Unknown component recipe "%"', v_item ->> 'componentSlug'
          using errcode = 'foreign_key_violation';
      end if;
    end if;

    -- The cycle trigger on recipe_items fires here and aborts the whole
    -- function if this link would close a loop.
    insert into recipe_items (
      recipe_id, ingredient_id, component_recipe_id,
      amount, amount_max, unit, optional, item_group, sort_order, item_key
    ) values (
      v_recipe_id,
      v_ingredient_id,
      v_component_id,
      nullif(v_item -> 'amount' ->> 'value', '')::numeric,
      nullif(v_item -> 'amount' ->> 'max', '')::numeric,
      nullif(v_item -> 'amount' ->> 'unit', '')::unit_code,
      coalesce((v_item ->> 'optional')::boolean, false),
      nullif(v_item ->> 'group', ''),
      coalesce((v_item ->> 'sortOrder')::integer, 0),
      v_item ->> 'key'
    );
  end loop;

  for v_step in select * from jsonb_array_elements(coalesce(p_draft -> 'steps', '[]'::jsonb)) loop
    insert into recipe_steps (
      recipe_id, step_key, sort_order, phase, active_minutes,
      wait_min_minutes, wait_max_minutes, duration_known, temperature_c, timer_seconds
    ) values (
      v_recipe_id,
      v_step ->> 'key',
      coalesce((v_step ->> 'sortOrder')::integer, 0),
      (v_step ->> 'phase')::step_phase,
      coalesce((v_step ->> 'activeMinutes')::integer, 0),
      coalesce((v_step ->> 'waitMinMinutes')::integer, 0),
      coalesce((v_step ->> 'waitMaxMinutes')::integer, 0),
      coalesce((v_step ->> 'durationKnown')::boolean, true),
      nullif(v_step ->> 'temperatureC', '')::numeric,
      nullif(v_step ->> 'timerSeconds', '')::integer
    )
    returning id into v_step_id;

    for v_locale in select unnest(array['ru', 'en', 'fr']) loop
      insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
      values (
        v_step_id,
        v_locale::app_locale,
        coalesce(nullif(v_step -> 'instructions' ->> v_locale, ''), ''),
        nullif(v_step -> 'cues' ->> v_locale, ''),
        nullif(v_step -> 'troubleshooting' ->> v_locale, '')
      )
      on conflict (step_id, locale) do update set
        instruction = excluded.instruction,
        sensory_cues = excluded.sensory_cues,
        troubleshooting = excluded.troubleshooting;
    end loop;

    for v_item_key in
      select value::text from jsonb_array_elements_text(coalesce(v_step -> 'itemKeys', '[]'::jsonb))
    loop
      select id into v_item_id
      from recipe_items
      where recipe_id = v_recipe_id and item_key = v_item_key;

      if v_item_id is not null then
        insert into recipe_step_items (step_id, item_id)
        values (v_step_id, v_item_id)
        on conflict (step_id, item_id) do nothing;
      end if;
    end loop;
  end loop;

  -- Source and evidence are rebuilt too.
  delete from recipe_sources where recipe_id = v_recipe_id;
  delete from field_evidence
  where owner_id = v_owner
    and (
      (entity_type = 'recipe' and entity_id = v_recipe_id)
      or (entity_type = 'recipe_item'
          and entity_id in (select id from recipe_items where recipe_id = v_recipe_id))
    );

  if p_draft -> 'source' is not null and jsonb_typeof(p_draft -> 'source') = 'object' then
    insert into recipe_sources (
      recipe_id, source_type, author, title, url, attribution, credibility_tier
    ) values (
      v_recipe_id,
      (p_draft -> 'source' ->> 'sourceType')::source_type,
      nullif(p_draft -> 'source' ->> 'author', ''),
      nullif(p_draft -> 'source' ->> 'title', ''),
      nullif(p_draft -> 'source' ->> 'url', ''),
      nullif(p_draft -> 'source' ->> 'attribution', ''),
      coalesce((p_draft -> 'source' ->> 'credibilityTier')::numeric, 0.5)
    )
    returning id into v_source_id;
  end if;

  for v_evidence in
    select * from jsonb_array_elements(coalesce(p_draft -> 'evidence', '[]'::jsonb))
  loop
    if nullif(v_evidence ->> 'itemKey', '') is not null then
      select id into v_target_id from recipe_items
      where recipe_id = v_recipe_id and item_key = v_evidence ->> 'itemKey';
    else
      v_target_id := v_recipe_id;
    end if;

    if v_target_id is null then
      continue;
    end if;

    insert into field_evidence (
      owner_id, entity_type, entity_id, field, source_id,
      confidence, review_state, conflict_group
    ) values (
      v_owner,
      case when nullif(v_evidence ->> 'itemKey', '') is not null then 'recipe_item' else 'recipe' end,
      v_target_id,
      v_evidence ->> 'field',
      v_source_id,
      coalesce((v_evidence ->> 'confidence')::numeric, 0),
      (v_evidence ->> 'reviewState')::review_state,
      nullif(v_evidence ->> 'conflictGroup', '')
    )
    returning id into v_evidence_id;

    for v_locale in select unnest(array['ru', 'en', 'fr']) loop
      insert into field_evidence_translations (evidence_id, locale, note)
      values (
        v_evidence_id,
        v_locale::app_locale,
        coalesce(nullif(v_evidence -> 'notes' ->> v_locale, ''), '')
      )
      on conflict (evidence_id, locale) do update set note = excluded.note;
    end loop;
  end loop;

  return jsonb_build_object(
    'slug', v_slug,
    'recipeId', v_recipe_id,
    'created', v_created,
    'versionCreated', v_versioned
  );
end;
$$;

comment on function save_recipe(jsonb, boolean) is
  'Writes a whole recipe in one transaction. SECURITY INVOKER, so RLS applies.';

-- ---------------------------------------------------------------------------
-- restore_recipe_version
-- ---------------------------------------------------------------------------

create or replace function make_version_primary(p_version_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := (select auth.uid());
  v_version recipe_versions%rowtype;
begin
  select * into v_version from recipe_versions
  where id = p_version_id and owner_id = v_owner;

  if not found then
    raise exception 'No such version' using errcode = 'no_data_found';
  end if;

  update recipe_versions set is_primary = (id = p_version_id)
  where recipe_id = v_version.recipe_id;
end;
$$;
