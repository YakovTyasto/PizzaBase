-- Exercises save_recipe against a seeded database.
--
-- The point of these checks is the guarantee the function exists for: a whole
-- recipe lands or none of it does. A failure part-way through must leave the
-- previous state exactly as it was.
--
-- `request.jwt.claim.sub` is set by the harness so auth.uid() resolves and RLS
-- behaves as it would for a signed-in user.

\set ON_ERROR_STOP on

do $$
declare
  failures text[] := '{}';
  v_owner uuid := current_setting('request.jwt.claim.sub')::uuid;
  v_result jsonb;
  v_id uuid;
  n integer;
  before_recipes integer;
  before_items integer;
begin
  -- ---------------------------------------------------------------------
  -- Creating a recipe writes every child table.
  -- ---------------------------------------------------------------------
  select save_recipe(jsonb_build_object(
    'slug', 'test-sauce',
    'type', 'sauce',
    'status', 'draft',
    'authenticity', 'user_verified',
    'originLocale', 'ru',
    'baseYield', '400',
    'yieldUnit', 'g',
    'tags', jsonb_build_array('test'),
    'names', jsonb_build_object('ru', 'Тестовый соус', 'en', 'Test sauce', 'fr', 'Sauce test'),
    'summaries', jsonb_build_object('ru', 'Описание', 'en', '', 'fr', ''),
    'notes', jsonb_build_object('ru', '', 'en', '', 'fr', ''),
    'items', jsonb_build_array(
      jsonb_build_object(
        'key', 'tomatoes',
        'ingredientSlug', 'tomatoes-whole-peeled-canned',
        'amount', jsonb_build_object('kind', 'exact', 'value', '400', 'unit', 'g'),
        'optional', false, 'sortOrder', 0
      ),
      jsonb_build_object(
        'key', 'salt',
        'ingredientSlug', 'salt-sea',
        'amount', jsonb_build_object('kind', 'qualitative', 'unit', 'to_taste'),
        'optional', false, 'sortOrder', 1
      )
    ),
    'steps', jsonb_build_array(
      jsonb_build_object(
        'key', 'crush', 'phase', 'prep', 'sortOrder', 0,
        'activeMinutes', 5, 'waitMinMinutes', 0, 'waitMaxMinutes', 0,
        'durationKnown', true,
        'itemKeys', jsonb_build_array('tomatoes'),
        'instructions', jsonb_build_object('ru', 'Раздавить', 'en', 'Crush', 'fr', 'Écraser'),
        'cues', jsonb_build_object('ru', '', 'en', '', 'fr', ''),
        'troubleshooting', jsonb_build_object('ru', '', 'en', '', 'fr', '')
      )
    ),
    'source', jsonb_build_object(
      'sourceType', 'user', 'credibilityTier', 0.7,
      'author', null, 'title', null, 'url', null, 'attribution', null
    ),
    'evidence', jsonb_build_array()
  )) into v_result;

  if (v_result ->> 'created')::boolean is not true then
    failures := failures || 'save_recipe did not report a creation';
  end if;

  select id into v_id from recipes where slug = 'test-sauce' and owner_id = v_owner;
  if v_id is null then
    failures := failures || 'the recipe was not created';
  end if;

  select count(*) into n from recipe_items where recipe_id = v_id;
  if n <> 2 then failures := failures || format('expected 2 items, got %s', n); end if;

  select count(*) into n from recipe_translations where recipe_id = v_id;
  if n <> 3 then failures := failures || format('expected 3 translations, got %s', n); end if;

  select count(*) into n
  from recipe_step_items si
  join recipe_steps s on s.id = si.step_id
  where s.recipe_id = v_id;
  if n <> 1 then failures := failures || 'the step/item link was not written'; end if;

  -- The qualitative amount kept its unit and stored no number.
  select count(*) into n from recipe_items
  where recipe_id = v_id and item_key = 'salt' and amount is null and unit = 'to_taste';
  if n <> 1 then failures := failures || 'the qualitative amount was not stored correctly'; end if;

  -- ---------------------------------------------------------------------
  -- Editing replaces children rather than accumulating them.
  -- ---------------------------------------------------------------------
  select save_recipe(jsonb_build_object(
    'slug', 'test-sauce', 'type', 'sauce', 'status', 'draft',
    'authenticity', 'user_verified', 'originLocale', 'ru',
    'baseYield', '500', 'yieldUnit', 'g', 'tags', jsonb_build_array(),
    'names', jsonb_build_object('ru', 'Тестовый соус 2', 'en', 'Test sauce 2', 'fr', 'Sauce test 2'),
    'summaries', jsonb_build_object('ru', '', 'en', '', 'fr', ''),
    'notes', jsonb_build_object('ru', '', 'en', '', 'fr', ''),
    'items', jsonb_build_array(jsonb_build_object(
      'key', 'tomatoes', 'ingredientSlug', 'tomatoes-whole-peeled-canned',
      'amount', jsonb_build_object('kind', 'exact', 'value', '500', 'unit', 'g'),
      'optional', false, 'sortOrder', 0
    )),
    'steps', jsonb_build_array(),
    'evidence', jsonb_build_array()
  )) into v_result;

  if (v_result ->> 'created')::boolean is not false then
    failures := failures || 'an edit was reported as a creation';
  end if;

  select count(*) into n from recipe_items where recipe_id = v_id;
  if n <> 1 then failures := failures || format('edit left %s items instead of 1', n); end if;

  select count(*) into n from recipes where slug = 'test-sauce' and owner_id = v_owner;
  if n <> 1 then failures := failures || 'editing created a duplicate recipe'; end if;

  -- ---------------------------------------------------------------------
  -- A failure rolls the whole write back.
  -- ---------------------------------------------------------------------
  select count(*) into before_recipes from recipes;
  select count(*) into before_items from recipe_items;

  begin
    perform save_recipe(jsonb_build_object(
      'slug', 'test-broken', 'type', 'sauce', 'status', 'draft',
      'authenticity', 'user_verified', 'originLocale', 'ru',
      'tags', jsonb_build_array(),
      'names', jsonb_build_object('ru', 'Сломанный', 'en', 'Broken', 'fr', 'Cassé'),
      'summaries', jsonb_build_object('ru', '', 'en', '', 'fr', ''),
      'notes', jsonb_build_object('ru', '', 'en', '', 'fr', ''),
      'items', jsonb_build_array(
        jsonb_build_object(
          'key', 'ok', 'ingredientSlug', 'salt-sea',
          'amount', jsonb_build_object('kind', 'exact', 'value', '5', 'unit', 'g'),
          'optional', false, 'sortOrder', 0
        ),
        -- This ingredient does not exist, so the function raises.
        jsonb_build_object(
          'key', 'bad', 'ingredientSlug', 'no-such-ingredient-anywhere',
          'amount', jsonb_build_object('kind', 'exact', 'value', '1', 'unit', 'g'),
          'optional', false, 'sortOrder', 1
        )
      ),
      'steps', jsonb_build_array(),
      'evidence', jsonb_build_array()
    ));
    failures := failures || 'an unknown ingredient did not abort the save';
  exception
    when foreign_key_violation then
      null; -- expected
  end;

  select count(*) into n from recipes;
  if n <> before_recipes then
    failures := failures || 'a failed save left a partially created recipe behind';
  end if;
  select count(*) into n from recipe_items;
  if n <> before_items then
    failures := failures || 'a failed save left orphaned items behind';
  end if;
  select count(*) into n from recipes where slug = 'test-broken';
  if n <> 0 then failures := failures || 'the aborted recipe row survived'; end if;

  -- ---------------------------------------------------------------------
  -- The cycle trigger aborts a save that would close a loop.
  -- ---------------------------------------------------------------------
  begin
    perform save_recipe(jsonb_build_object(
      'slug', 'test-sauce', 'type', 'sauce', 'status', 'draft',
      'authenticity', 'user_verified', 'originLocale', 'ru',
      'tags', jsonb_build_array(),
      'names', jsonb_build_object('ru', 'Петля', 'en', 'Loop', 'fr', 'Boucle'),
      'summaries', jsonb_build_object('ru', '', 'en', '', 'fr', ''),
      'notes', jsonb_build_object('ru', '', 'en', '', 'fr', ''),
      'items', jsonb_build_array(jsonb_build_object(
        'key', 'self', 'componentSlug', 'test-sauce',
        'amount', jsonb_build_object('kind', 'exact', 'value', '10', 'unit', 'g'),
        'optional', false, 'sortOrder', 0
      )),
      'steps', jsonb_build_array(),
      'evidence', jsonb_build_array()
    ));
    failures := failures || 'a self-referencing component was accepted';
  exception
    when check_violation then
      null; -- expected
  end;

  -- ---------------------------------------------------------------------
  -- Editing a verified recipe snapshots the previous version.
  -- ---------------------------------------------------------------------
  update recipes set status = 'verified' where id = v_id;

  select save_recipe(jsonb_build_object(
    'slug', 'test-sauce', 'type', 'sauce', 'status', 'verified',
    'authenticity', 'user_verified', 'originLocale', 'ru',
    'baseYield', '600', 'yieldUnit', 'g', 'tags', jsonb_build_array(),
    'names', jsonb_build_object('ru', 'Версия 2', 'en', 'Version 2', 'fr', 'Version 2'),
    'summaries', jsonb_build_object('ru', '', 'en', '', 'fr', ''),
    'notes', jsonb_build_object('ru', '', 'en', '', 'fr', ''),
    'items', jsonb_build_array(jsonb_build_object(
      'key', 'tomatoes', 'ingredientSlug', 'tomatoes-whole-peeled-canned',
      'amount', jsonb_build_object('kind', 'exact', 'value', '600', 'unit', 'g'),
      'optional', false, 'sortOrder', 0
    )),
    'steps', jsonb_build_array(),
    'evidence', jsonb_build_array()
  )) into v_result;

  if (v_result ->> 'versionCreated')::boolean is not true then
    failures := failures || 'editing a verified recipe did not snapshot a version';
  end if;

  select count(*) into n from recipe_versions where recipe_id = v_id;
  if n < 1 then failures := failures || 'no version row was written'; end if;

  -- The snapshot preserved the old yield, so nothing was destroyed.
  select count(*) into n from recipe_versions
  where recipe_id = v_id and (snapshot -> 'recipe' ->> 'base_yield')::numeric = 500;
  if n <> 1 then failures := failures || 'the snapshot does not hold the previous state'; end if;

  -- ---------------------------------------------------------------------
  -- Import idempotency is enforced by the primary key.
  -- ---------------------------------------------------------------------
  insert into approved_imports (owner_id, idempotency_key, recipe_id)
  values (v_owner, 'key-abc', v_id);
  begin
    insert into approved_imports (owner_id, idempotency_key, recipe_id)
    values (v_owner, 'key-abc', v_id);
    failures := failures || 'a duplicate import key was accepted';
  exception
    when unique_violation then
      null; -- expected
  end;

  -- Clean up so re-running the verification script stays deterministic.
  delete from recipes where slug = 'test-sauce' and owner_id = v_owner;
  delete from approved_imports where owner_id = v_owner;

  if array_length(failures, 1) is null then
    raise notice '    save_recipe behaves atomically';
  else
    raise exception E'Authoring assertions failed:\n  - %', array_to_string(failures, E'\n  - ');
  end if;
end
$$;
