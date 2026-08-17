-- Schema invariants, asserted against a seeded database.
--
-- These check the guarantees the schema is supposed to make of the *data*,
-- not just of the code that reads it: the cycle trigger, the single-target
-- constraint, RLS coverage, and that the seed's honesty rules survived the
-- round trip through SQL.

\set ON_ERROR_STOP on

do $$
declare
  failures text[] := '{}';
  n integer;
  ok boolean;
begin
  -- ---------------------------------------------------------------------
  -- Every owner-scoped table must have RLS enabled. A new table added
  -- without a policy should fail here rather than leak silently.
  -- ---------------------------------------------------------------------
  select count(*) into n
  from pg_tables t
  join pg_class c on c.relname = t.tablename
  join pg_namespace ns on ns.oid = c.relnamespace and ns.nspname = 'public'
  where t.schemaname = 'public' and not c.relrowsecurity;

  if n > 0 then
    failures := failures || format('%s public tables have RLS disabled', n);
  end if;

  -- ---------------------------------------------------------------------
  -- The cycle trigger must reject a loop.
  -- ---------------------------------------------------------------------
  begin
    insert into recipe_items (recipe_id, component_recipe_id, sort_order)
    select r.id, r.id, 999
    from recipes r where r.slug = 'tomato-sauce-user';
    failures := failures || 'a recipe was allowed to contain itself';
  exception
    when check_violation then
      null; -- expected: the recipe_item_not_self constraint
  end;

  -- An indirect cycle: make the sauce depend on a pizza that uses the sauce.
  begin
    insert into recipe_items (recipe_id, component_recipe_id, amount, unit, sort_order)
    select s.id, p.id, 10, 'g', 998
    from recipes s, recipes p
    where s.slug = 'tomato-sauce-user' and p.slug = 'margherita-user';
    failures := failures || 'an indirect recipe cycle was allowed';
  exception
    when check_violation then
      null; -- expected: raised by the assert_no_recipe_cycle trigger
  end;

  -- ---------------------------------------------------------------------
  -- A composition line must reference exactly one target.
  -- ---------------------------------------------------------------------
  begin
    insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, sort_order)
    select r.id, i.id, c.id, 997
    from recipes r, ingredients i, recipes c
    where r.slug = 'margherita-user' and i.slug = 'water' and c.slug = 'tomato-sauce-user';
    failures := failures || 'an item with both an ingredient and a component was allowed';
  exception
    when check_violation then
      null; -- expected
  end;

  begin
    insert into recipe_items (recipe_id, sort_order)
    select r.id, 996 from recipes r where r.slug = 'margherita-user';
    failures := failures || 'an item with neither target was allowed';
  exception
    when check_violation then
      null; -- expected
  end;

  -- ---------------------------------------------------------------------
  -- Ranges must be ordered.
  -- ---------------------------------------------------------------------
  begin
    insert into recipe_items (recipe_id, ingredient_id, amount, amount_max, unit, sort_order)
    select r.id, i.id, 30, 25, 'g', 995
    from recipes r, ingredients i
    where r.slug = 'margherita-user' and i.slug = 'salt-sea';
    failures := failures || 'an inverted range was allowed';
  exception
    when check_violation then
      null; -- expected
  end;

  -- ---------------------------------------------------------------------
  -- Seed honesty rules, verified after the SQL round trip.
  -- ---------------------------------------------------------------------

  -- The owner's pizzas must never be labelled traditional.
  select count(*) into n
  from recipes
  where slug like '%-user' and type = 'pizza' and authenticity = 'traditional';
  if n > 0 then
    failures := failures || 'an owner pizza is labelled traditional';
  end if;

  -- Unknown amounts really are null, not zero.
  select count(*) into n
  from recipe_items i
  join recipes r on r.id = i.recipe_id
  where r.slug = 'margherita-user' and i.amount is null and i.unit is null;
  if n = 0 then
    failures := failures || 'Margherita lost its unknown amounts in the seed';
  end if;

  select count(*) into n from recipe_items where amount = 0 and unit is not null;
  if n > 0 then
    failures := failures || 'an unknown amount was stored as zero';
  end if;

  -- The pesto yield conflict survived.
  select count(*) into n
  from field_evidence e
  where e.review_state = 'conflict'
    and e.entity_id = (select id from recipes where slug = 'pesto-genovese-user');
  if n = 0 then
    failures := failures || 'the pesto yield conflict is missing';
  end if;

  -- The Iacopelli salt stayed a range rather than a single chosen value.
  select (i.amount = 25 and i.amount_max = 30) into ok
  from recipe_items i
  join recipes r on r.id = i.recipe_id
  where r.slug = 'iacopelli-poolish-double-fermentation' and i.item_key = 'final-salt';
  if ok is distinct from true then
    failures := failures || 'the Iacopelli salt range was not preserved';
  end if;

  -- Nothing carrying a conflict may be marked verified.
  select count(*) into n
  from recipes r
  where r.status = 'verified'
    and exists (
      select 1 from field_evidence e
      where e.entity_id = r.id and e.review_state = 'conflict'
    );
  if n > 0 then
    failures := failures || 'a recipe with an open conflict is marked verified';
  end if;

  -- Ketchup-style swaps stay unapproved.
  select count(*) into n
  from ingredient_substitutions s
  join ingredients f on f.id = s.from_ingredient_id
  where f.slug = 'tomatoes-whole-peeled-canned' and s.approved;
  if n > 0 then
    failures := failures || 'a tomato substitution was approved';
  end if;

  -- The tomato sauce gained no ingredients the owner never mentioned.
  select count(*) into n
  from recipe_items i
  join recipes r on r.id = i.recipe_id
  where r.slug = 'tomato-sauce-user';
  if n <> 4 then
    failures := failures || format('the tomato sauce has %s ingredients, expected 4', n);
  end if;

  -- Every ingredient and recipe has all three locales.
  select count(*) into n
  from ingredients i
  where (select count(*) from ingredient_translations t where t.ingredient_id = i.id) <> 3;
  if n > 0 then
    failures := failures || format('%s ingredients lack all three locales', n);
  end if;

  select count(*) into n
  from recipes r
  where (select count(*) from recipe_translations t where t.recipe_id = r.id) <> 3;
  if n > 0 then
    failures := failures || format('%s recipes lack all three locales', n);
  end if;

  -- Accent-insensitive search must find the French alias from a bare query.
  select count(*) into n
  from ingredient_aliases
  where normalized_alias like '%roquette%';
  if n = 0 then
    failures := failures || 'the normalized alias index is not populated';
  end if;

  -- ---------------------------------------------------------------------
  if array_length(failures, 1) is null then
    raise notice '    all schema invariants hold';
  else
    raise exception E'Schema assertions failed:\n  - %', array_to_string(failures, E'\n  - ');
  end if;
end
$$;
