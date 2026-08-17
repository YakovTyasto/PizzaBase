-- Impasto seed data.
--
-- GENERATED FILE - do not edit by hand.
-- Source: src/lib/seed/*.ts     Regenerate: npm run seed
--
-- Idempotent: every statement upserts on a stable slug, so re-running
-- this file converges rather than duplicating.
--
-- Usage:
--   psql "$DATABASE_URL" -v owner_id="'<auth.users.id>'" -f supabase/seed.sql
--
-- The shared catalog (categories, ingredients, styles, ovens) is owned by
-- nobody (owner_id is null) and is readable by every signed-in user.
-- Recipes belong to :owner_id.

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
insert into ingredient_categories (slug, sort_order) values ('produce', 10)
  on conflict (slug) do update set sort_order = excluded.sort_order;
insert into ingredient_category_translations (category_id, locale, name) select id, 'ru', 'Овощи и фрукты' from ingredient_categories where slug = 'produce'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_category_translations (category_id, locale, name) select id, 'en', 'Produce' from ingredient_categories where slug = 'produce'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_category_translations (category_id, locale, name) select id, 'fr', 'Fruits et légumes' from ingredient_categories where slug = 'produce'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_categories (slug, sort_order) values ('herbs', 20)
  on conflict (slug) do update set sort_order = excluded.sort_order;
insert into ingredient_category_translations (category_id, locale, name) select id, 'ru', 'Зелень' from ingredient_categories where slug = 'herbs'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_category_translations (category_id, locale, name) select id, 'en', 'Herbs' from ingredient_categories where slug = 'herbs'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_category_translations (category_id, locale, name) select id, 'fr', 'Herbes' from ingredient_categories where slug = 'herbs'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_categories (slug, sort_order) values ('dairy', 30)
  on conflict (slug) do update set sort_order = excluded.sort_order;
insert into ingredient_category_translations (category_id, locale, name) select id, 'ru', 'Молочные продукты' from ingredient_categories where slug = 'dairy'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_category_translations (category_id, locale, name) select id, 'en', 'Dairy' from ingredient_categories where slug = 'dairy'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_category_translations (category_id, locale, name) select id, 'fr', 'Produits laitiers' from ingredient_categories where slug = 'dairy'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_categories (slug, sort_order) values ('deli', 40)
  on conflict (slug) do update set sort_order = excluded.sort_order;
insert into ingredient_category_translations (category_id, locale, name) select id, 'ru', 'Мясная гастрономия' from ingredient_categories where slug = 'deli'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_category_translations (category_id, locale, name) select id, 'en', 'Deli' from ingredient_categories where slug = 'deli'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_category_translations (category_id, locale, name) select id, 'fr', 'Charcuterie' from ingredient_categories where slug = 'deli'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_categories (slug, sort_order) values ('canned', 50)
  on conflict (slug) do update set sort_order = excluded.sort_order;
insert into ingredient_category_translations (category_id, locale, name) select id, 'ru', 'Консервы' from ingredient_categories where slug = 'canned'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_category_translations (category_id, locale, name) select id, 'en', 'Canned goods' from ingredient_categories where slug = 'canned'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_category_translations (category_id, locale, name) select id, 'fr', 'Conserves' from ingredient_categories where slug = 'canned'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_categories (slug, sort_order) values ('baking', 60)
  on conflict (slug) do update set sort_order = excluded.sort_order;
insert into ingredient_category_translations (category_id, locale, name) select id, 'ru', 'Для выпечки' from ingredient_categories where slug = 'baking'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_category_translations (category_id, locale, name) select id, 'en', 'Baking' from ingredient_categories where slug = 'baking'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_category_translations (category_id, locale, name) select id, 'fr', 'Boulangerie' from ingredient_categories where slug = 'baking'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_categories (slug, sort_order) values ('pantry', 70)
  on conflict (slug) do update set sort_order = excluded.sort_order;
insert into ingredient_category_translations (category_id, locale, name) select id, 'ru', 'Бакалея' from ingredient_categories where slug = 'pantry'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_category_translations (category_id, locale, name) select id, 'en', 'Pantry' from ingredient_categories where slug = 'pantry'
  on conflict (category_id, locale) do update set name = excluded.name;
insert into ingredient_category_translations (category_id, locale, name) select id, 'fr', 'Épicerie' from ingredient_categories where slug = 'pantry'
  on conflict (category_id, locale) do update set name = excluded.name;

-- ---------------------------------------------------------------------------
-- Styles and oven profiles
-- ---------------------------------------------------------------------------
insert into styles (slug) values ('napoletana') on conflict (slug) do nothing;
insert into style_translations (style_id, locale, name, description) select id, 'ru', 'Неаполитанская', 'Высокий воздушный бортик, короткая выпечка при очень высокой температуре.' from styles where slug = 'napoletana'
  on conflict (style_id, locale) do update set name = excluded.name, description = excluded.description;
insert into style_translations (style_id, locale, name, description) select id, 'en', 'Neapolitan', 'A puffed, airy cornicione and a very short bake at very high heat.' from styles where slug = 'napoletana'
  on conflict (style_id, locale) do update set name = excluded.name, description = excluded.description;
insert into style_translations (style_id, locale, name, description) select id, 'fr', 'Napolitaine', 'Une corniche aérée et une cuisson très courte à très haute température.' from styles where slug = 'napoletana'
  on conflict (style_id, locale) do update set name = excluded.name, description = excluded.description;
insert into styles (slug) values ('romana-tonda') on conflict (slug) do nothing;
insert into style_translations (style_id, locale, name, description) select id, 'ru', 'Римская тонда', 'Тонкая, хрустящая круглая пицца, раскатанная скалкой.' from styles where slug = 'romana-tonda'
  on conflict (style_id, locale) do update set name = excluded.name, description = excluded.description;
insert into style_translations (style_id, locale, name, description) select id, 'en', 'Roman tonda', 'A thin, crisp round pizza rolled out rather than hand-stretched.' from styles where slug = 'romana-tonda'
  on conflict (style_id, locale) do update set name = excluded.name, description = excluded.description;
insert into style_translations (style_id, locale, name, description) select id, 'fr', 'Romaine tonda', 'Une pizza ronde fine et croustillante, étalée au rouleau.' from styles where slug = 'romana-tonda'
  on conflict (style_id, locale) do update set name = excluded.name, description = excluded.description;
insert into styles (slug) values ('romana-teglia') on conflict (slug) do nothing;
insert into style_translations (style_id, locale, name, description) select id, 'ru', 'Римская в противне', 'Прямоугольная пицца в противне с высокой гидратацией и открытым мякишем.' from styles where slug = 'romana-teglia'
  on conflict (style_id, locale) do update set name = excluded.name, description = excluded.description;
insert into style_translations (style_id, locale, name, description) select id, 'en', 'Roman in teglia', 'A high-hydration rectangular pan pizza with an open crumb.' from styles where slug = 'romana-teglia'
  on conflict (style_id, locale) do update set name = excluded.name, description = excluded.description;
insert into style_translations (style_id, locale, name, description) select id, 'fr', 'Romaine en plaque', 'Une pizza rectangulaire en plaque, très hydratée, à mie ouverte.' from styles where slug = 'romana-teglia'
  on conflict (style_id, locale) do update set name = excluded.name, description = excluded.description;
insert into styles (slug) values ('contemporanea') on conflict (slug) do nothing;
insert into style_translations (style_id, locale, name, description) select id, 'ru', 'Современная', 'Современная итальянская школа: длинная ферментация, выраженный бортик.' from styles where slug = 'contemporanea'
  on conflict (style_id, locale) do update set name = excluded.name, description = excluded.description;
insert into style_translations (style_id, locale, name, description) select id, 'en', 'Contemporary', 'The modern Italian school: long fermentation and a pronounced rim.' from styles where slug = 'contemporanea'
  on conflict (style_id, locale) do update set name = excluded.name, description = excluded.description;
insert into style_translations (style_id, locale, name, description) select id, 'fr', 'Contemporaine', 'L''école italienne moderne : longue fermentation et corniche marquée.' from styles where slug = 'contemporanea'
  on conflict (style_id, locale) do update set name = excluded.name, description = excluded.description;
insert into oven_profiles (owner_id, slug, max_temperature_c) values (null, 'home-oven', 250)
  on conflict (slug) where owner_id is null do update set max_temperature_c = excluded.max_temperature_c;
insert into oven_profile_translations (oven_profile_id, locale, name) select id, 'ru', 'Домашняя духовка' from oven_profiles where slug = 'home-oven' and owner_id is null
  on conflict (oven_profile_id, locale) do update set name = excluded.name;
insert into oven_profile_translations (oven_profile_id, locale, name) select id, 'en', 'Home oven' from oven_profiles where slug = 'home-oven' and owner_id is null
  on conflict (oven_profile_id, locale) do update set name = excluded.name;
insert into oven_profile_translations (oven_profile_id, locale, name) select id, 'fr', 'Four domestique' from oven_profiles where slug = 'home-oven' and owner_id is null
  on conflict (oven_profile_id, locale) do update set name = excluded.name;
insert into oven_profiles (owner_id, slug, max_temperature_c) values (null, 'home-oven-steel', 300)
  on conflict (slug) where owner_id is null do update set max_temperature_c = excluded.max_temperature_c;
insert into oven_profile_translations (oven_profile_id, locale, name) select id, 'ru', 'Домашняя духовка со сталью' from oven_profiles where slug = 'home-oven-steel' and owner_id is null
  on conflict (oven_profile_id, locale) do update set name = excluded.name;
insert into oven_profile_translations (oven_profile_id, locale, name) select id, 'en', 'Home oven with baking steel' from oven_profiles where slug = 'home-oven-steel' and owner_id is null
  on conflict (oven_profile_id, locale) do update set name = excluded.name;
insert into oven_profile_translations (oven_profile_id, locale, name) select id, 'fr', 'Four domestique avec plaque acier' from oven_profiles where slug = 'home-oven-steel' and owner_id is null
  on conflict (oven_profile_id, locale) do update set name = excluded.name;
insert into oven_profiles (owner_id, slug, max_temperature_c) values (null, 'pizza-oven', 450)
  on conflict (slug) where owner_id is null do update set max_temperature_c = excluded.max_temperature_c;
insert into oven_profile_translations (oven_profile_id, locale, name) select id, 'ru', 'Электрическая печь для пиццы' from oven_profiles where slug = 'pizza-oven' and owner_id is null
  on conflict (oven_profile_id, locale) do update set name = excluded.name;
insert into oven_profile_translations (oven_profile_id, locale, name) select id, 'en', 'Electric pizza oven' from oven_profiles where slug = 'pizza-oven' and owner_id is null
  on conflict (oven_profile_id, locale) do update set name = excluded.name;
insert into oven_profile_translations (oven_profile_id, locale, name) select id, 'fr', 'Four à pizza électrique' from oven_profiles where slug = 'pizza-oven' and owner_id is null
  on conflict (oven_profile_id, locale) do update set name = excluded.name;
insert into oven_profiles (owner_id, slug, max_temperature_c) values (null, 'wood-fired', 485)
  on conflict (slug) where owner_id is null do update set max_temperature_c = excluded.max_temperature_c;
insert into oven_profile_translations (oven_profile_id, locale, name) select id, 'ru', 'Дровяная печь' from oven_profiles where slug = 'wood-fired' and owner_id is null
  on conflict (oven_profile_id, locale) do update set name = excluded.name;
insert into oven_profile_translations (oven_profile_id, locale, name) select id, 'en', 'Wood-fired oven' from oven_profiles where slug = 'wood-fired' and owner_id is null
  on conflict (oven_profile_id, locale) do update set name = excluded.name;
insert into oven_profile_translations (oven_profile_id, locale, name) select id, 'fr', 'Four à bois' from oven_profiles where slug = 'wood-fired' and owner_id is null
  on conflict (oven_profile_id, locale) do update set name = excluded.name;

-- ---------------------------------------------------------------------------
-- Ingredients, translations and aliases
-- ---------------------------------------------------------------------------
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'tomatoes-whole-peeled-canned', c.id, 'mass'::measure_kind, 'g'::unit_code, null, '{}'
from ingredient_categories c where c.slug = 'canned'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Целые очищенные томаты в собственном соку' from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Whole peeled tomatoes in their own juice' from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Tomates pelées entières dans leur jus' from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'olive-oil-extra-virgin', c.id, 'volume'::measure_kind, 'ml'::unit_code, 0.91, '{}'
from ingredient_categories c where c.slug = 'pantry'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Оливковое масло extra virgin' from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Extra virgin olive oil' from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Huile d''olive extra vierge' from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'salt-sea', c.id, 'mass'::measure_kind, 'g'::unit_code, null, '{}'
from ingredient_categories c where c.slug = 'pantry'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Морская соль' from ingredients where slug = 'salt-sea' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Sea salt' from ingredients where slug = 'salt-sea' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Sel de mer' from ingredients where slug = 'salt-sea' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'water', c.id, 'mass'::measure_kind, 'g'::unit_code, 1, '{}'
from ingredient_categories c where c.slug = 'pantry'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Вода' from ingredients where slug = 'water' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Water' from ingredients where slug = 'water' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Eau' from ingredients where slug = 'water' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'honey', c.id, 'mass'::measure_kind, 'g'::unit_code, 1.42, '{}'
from ingredient_categories c where c.slug = 'pantry'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Мёд' from ingredients where slug = 'honey' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Honey' from ingredients where slug = 'honey' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Miel' from ingredients where slug = 'honey' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'pine-nuts', c.id, 'mass'::measure_kind, 'g'::unit_code, null, ARRAY['tree_nuts']::text[]
from ingredient_categories c where c.slug = 'pantry'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Кедровые орехи' from ingredients where slug = 'pine-nuts' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Pine nuts' from ingredients where slug = 'pine-nuts' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Pignons de pin' from ingredients where slug = 'pine-nuts' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'flour-type-00', c.id, 'mass'::measure_kind, 'g'::unit_code, null, ARRAY['gluten']::text[]
from ingredient_categories c where c.slug = 'baking'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Мука типа 00' from ingredients where slug = 'flour-type-00' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Type 00 flour' from ingredients where slug = 'flour-type-00' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Farine type 00' from ingredients where slug = 'flour-type-00' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'flour-type-0', c.id, 'mass'::measure_kind, 'g'::unit_code, null, ARRAY['gluten']::text[]
from ingredient_categories c where c.slug = 'baking'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Мука типа 0' from ingredients where slug = 'flour-type-0' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Type 0 flour' from ingredients where slug = 'flour-type-0' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Farine type 0' from ingredients where slug = 'flour-type-0' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'flour-pinsa', c.id, 'mass'::measure_kind, 'g'::unit_code, null, ARRAY['gluten']::text[]
from ingredient_categories c where c.slug = 'baking'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Мука для пинсы' from ingredients where slug = 'flour-pinsa' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Pinsa flour' from ingredients where slug = 'flour-pinsa' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Farine à pinsa' from ingredients where slug = 'flour-pinsa' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'yeast-active-dry', c.id, 'mass'::measure_kind, 'g'::unit_code, null, '{}'
from ingredient_categories c where c.slug = 'baking'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Сухие активные дрожжи' from ingredients where slug = 'yeast-active-dry' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Active dry yeast' from ingredients where slug = 'yeast-active-dry' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Levure sèche active' from ingredients where slug = 'yeast-active-dry' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'mozzarella', c.id, 'mass'::measure_kind, 'g'::unit_code, null, '{}'
from ingredient_categories c where c.slug = 'dairy'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Моцарелла' from ingredients where slug = 'mozzarella' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Mozzarella' from ingredients where slug = 'mozzarella' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Mozzarella' from ingredients where slug = 'mozzarella' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'mozzarella-fior-di-latte', c.id, 'mass'::measure_kind, 'g'::unit_code, null, ARRAY['milk']::text[]
from ingredient_categories c where c.slug = 'dairy'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Моцарелла фиор ди латте' from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Mozzarella fior di latte' from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Mozzarella fior di latte' from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'mozzarella-di-bufala', c.id, 'mass'::measure_kind, 'g'::unit_code, null, ARRAY['milk']::text[]
from ingredient_categories c where c.slug = 'dairy'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Моцарелла ди буфала' from ingredients where slug = 'mozzarella-di-bufala' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Mozzarella di bufala' from ingredients where slug = 'mozzarella-di-bufala' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Mozzarella di bufala' from ingredients where slug = 'mozzarella-di-bufala' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'parmigiano-reggiano', c.id, 'mass'::measure_kind, 'g'::unit_code, null, ARRAY['milk']::text[]
from ingredient_categories c where c.slug = 'dairy'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Пармезан' from ingredients where slug = 'parmigiano-reggiano' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Parmesan' from ingredients where slug = 'parmigiano-reggiano' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Parmesan' from ingredients where slug = 'parmigiano-reggiano' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'pecorino', c.id, 'mass'::measure_kind, 'g'::unit_code, null, ARRAY['milk']::text[]
from ingredient_categories c where c.slug = 'dairy'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Пекорино' from ingredients where slug = 'pecorino' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Pecorino' from ingredients where slug = 'pecorino' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Pecorino' from ingredients where slug = 'pecorino' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'pecorino-sardo', c.id, 'mass'::measure_kind, 'g'::unit_code, null, ARRAY['milk']::text[]
from ingredient_categories c where c.slug = 'dairy'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Пекорино Сардо' from ingredients where slug = 'pecorino-sardo' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Pecorino Sardo' from ingredients where slug = 'pecorino-sardo' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Pecorino Sardo' from ingredients where slug = 'pecorino-sardo' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'fontal', c.id, 'mass'::measure_kind, 'g'::unit_code, null, ARRAY['milk']::text[]
from ingredient_categories c where c.slug = 'dairy'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Фонталь' from ingredients where slug = 'fontal' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Fontal' from ingredients where slug = 'fontal' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Fontal' from ingredients where slug = 'fontal' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'gorgonzola', c.id, 'mass'::measure_kind, 'g'::unit_code, null, ARRAY['milk']::text[]
from ingredient_categories c where c.slug = 'dairy'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Горгонзола' from ingredients where slug = 'gorgonzola' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Gorgonzola' from ingredients where slug = 'gorgonzola' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Gorgonzola' from ingredients where slug = 'gorgonzola' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'pepperoni', c.id, 'mass'::measure_kind, 'g'::unit_code, null, '{}'
from ingredient_categories c where c.slug = 'deli'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Пепперони' from ingredients where slug = 'pepperoni' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Pepperoni' from ingredients where slug = 'pepperoni' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Pepperoni' from ingredients where slug = 'pepperoni' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'mortadella', c.id, 'mass'::measure_kind, 'g'::unit_code, null, ARRAY['pistachio']::text[]
from ingredient_categories c where c.slug = 'deli'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Мортаделла' from ingredients where slug = 'mortadella' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Mortadella' from ingredients where slug = 'mortadella' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Mortadelle' from ingredients where slug = 'mortadella' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'italian-sausage', c.id, 'mass'::measure_kind, 'g'::unit_code, null, '{}'
from ingredient_categories c where c.slug = 'deli'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Итальянская колбаска' from ingredients where slug = 'italian-sausage' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Italian sausage' from ingredients where slug = 'italian-sausage' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Saucisse italienne' from ingredients where slug = 'italian-sausage' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'nduja', c.id, 'mass'::measure_kind, 'g'::unit_code, null, '{}'
from ingredient_categories c where c.slug = 'deli'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Ндуйя' from ingredients where slug = 'nduja' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', '''Nduja' from ingredients where slug = 'nduja' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', '''Nduja' from ingredients where slug = 'nduja' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'soppressata', c.id, 'mass'::measure_kind, 'g'::unit_code, null, '{}'
from ingredient_categories c where c.slug = 'deli'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Соппрессата' from ingredients where slug = 'soppressata' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Soppressata' from ingredients where slug = 'soppressata' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Soppressata' from ingredients where slug = 'soppressata' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'basil-fresh', c.id, 'count'::measure_kind, 'leaf'::unit_code, null, '{}'
from ingredient_categories c where c.slug = 'herbs'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Базилик свежий' from ingredients where slug = 'basil-fresh' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Fresh basil' from ingredients where slug = 'basil-fresh' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Basilic frais' from ingredients where slug = 'basil-fresh' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'garlic', c.id, 'count'::measure_kind, 'clove'::unit_code, null, '{}'
from ingredient_categories c where c.slug = 'produce'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Чеснок' from ingredients where slug = 'garlic' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Garlic' from ingredients where slug = 'garlic' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Ail' from ingredients where slug = 'garlic' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'arugula', c.id, 'mass'::measure_kind, 'g'::unit_code, null, '{}'
from ingredient_categories c where c.slug = 'produce'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Руккола' from ingredients where slug = 'arugula' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Arugula' from ingredients where slug = 'arugula' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Roquette' from ingredients where slug = 'arugula' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'pear', c.id, 'count'::measure_kind, 'piece'::unit_code, null, '{}'
from ingredient_categories c where c.slug = 'produce'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Груша' from ingredients where slug = 'pear' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Pear' from ingredients where slug = 'pear' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Poire' from ingredients where slug = 'pear' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)
select null, 'chili-flakes', c.id, 'mass'::measure_kind, 'g'::unit_code, null, '{}'
from ingredient_categories c where c.slug = 'pantry'
  on conflict (slug) where owner_id is null do update set
    category_id = excluded.category_id,
    measure = excluded.measure,
    base_unit = excluded.base_unit,
    density_g_per_ml = excluded.density_g_per_ml,
    allergens = excluded.allergens;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'ru', 'Хлопья острого перца' from ingredients where slug = 'chili-flakes' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'en', 'Chili flakes' from ingredients where slug = 'chili-flakes' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;
insert into ingredient_translations (ingredient_id, locale, name) select id, 'fr', 'Flocons de piment' from ingredients where slug = 'chili-flakes' and owner_id is null
  on conflict (ingredient_id, locale) do update set name = excluded.name;

-- Parent links (second pass so forward references resolve)
update ingredients set parent_id = (select id from ingredients where slug = 'mozzarella' and owner_id is null) where slug = 'mozzarella-fior-di-latte' and owner_id is null;
update ingredients set parent_id = (select id from ingredients where slug = 'mozzarella' and owner_id is null) where slug = 'mozzarella-di-bufala' and owner_id is null;
update ingredients set parent_id = (select id from ingredients where slug = 'pecorino' and owner_id is null) where slug = 'pecorino-sardo' and owner_id is null;

-- Aliases. Deleted and reinserted so removals in the catalog take effect.
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null), 'ru'::app_locale, 'томаты в собственном соку'),
  ((select id from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null), 'ru'::app_locale, 'помидоры очищенные'),
  ((select id from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null), 'ru'::app_locale, 'консервированные томаты'),
  ((select id from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null), 'en'::app_locale, 'canned tomatoes'),
  ((select id from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null), 'en'::app_locale, 'peeled tomatoes'),
  ((select id from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null), 'en'::app_locale, 'pelati'),
  ((select id from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null), 'en'::app_locale, 'san marzano'),
  ((select id from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null), 'fr'::app_locale, 'tomates pelées'),
  ((select id from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null), 'fr'::app_locale, 'tomates en conserve'),
  ((select id from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null), 'fr'::app_locale, 'pelati'),
  ((select id from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null), 'ru'::app_locale, 'Целые очищенные томаты в собственном соку'),
  ((select id from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null), 'en'::app_locale, 'Whole peeled tomatoes in their own juice'),
  ((select id from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null), 'fr'::app_locale, 'Tomates pelées entières dans leur jus');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null), 'ru'::app_locale, 'оливковое масло'),
  ((select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null), 'ru'::app_locale, 'масло оливковое первого отжима'),
  ((select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null), 'en'::app_locale, 'evoo'),
  ((select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null), 'en'::app_locale, 'olive oil'),
  ((select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null), 'en'::app_locale, 'extra-virgin olive oil'),
  ((select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null), 'fr'::app_locale, 'huile d''olive'),
  ((select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null), 'fr'::app_locale, 'huile olive vierge extra'),
  ((select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null), 'ru'::app_locale, 'Оливковое масло extra virgin'),
  ((select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null), 'en'::app_locale, 'Extra virgin olive oil'),
  ((select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null), 'fr'::app_locale, 'Huile d''olive extra vierge');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'salt-sea' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'salt-sea' and owner_id is null), 'ru'::app_locale, 'соль'),
  ((select id from ingredients where slug = 'salt-sea' and owner_id is null), 'en'::app_locale, 'salt'),
  ((select id from ingredients where slug = 'salt-sea' and owner_id is null), 'en'::app_locale, 'fine sea salt'),
  ((select id from ingredients where slug = 'salt-sea' and owner_id is null), 'fr'::app_locale, 'sel'),
  ((select id from ingredients where slug = 'salt-sea' and owner_id is null), 'ru'::app_locale, 'Морская соль'),
  ((select id from ingredients where slug = 'salt-sea' and owner_id is null), 'en'::app_locale, 'Sea salt'),
  ((select id from ingredients where slug = 'salt-sea' and owner_id is null), 'fr'::app_locale, 'Sel de mer');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'water' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'water' and owner_id is null), 'ru'::app_locale, 'вода питьевая'),
  ((select id from ingredients where slug = 'water' and owner_id is null), 'en'::app_locale, 'cold water'),
  ((select id from ingredients where slug = 'water' and owner_id is null), 'fr'::app_locale, 'eau froide'),
  ((select id from ingredients where slug = 'water' and owner_id is null), 'ru'::app_locale, 'Вода'),
  ((select id from ingredients where slug = 'water' and owner_id is null), 'en'::app_locale, 'Water'),
  ((select id from ingredients where slug = 'water' and owner_id is null), 'fr'::app_locale, 'Eau');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'honey' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'honey' and owner_id is null), 'ru'::app_locale, 'мед'),
  ((select id from ingredients where slug = 'honey' and owner_id is null), 'en'::app_locale, 'runny honey'),
  ((select id from ingredients where slug = 'honey' and owner_id is null), 'fr'::app_locale, 'miel liquide'),
  ((select id from ingredients where slug = 'honey' and owner_id is null), 'ru'::app_locale, 'Мёд'),
  ((select id from ingredients where slug = 'honey' and owner_id is null), 'en'::app_locale, 'Honey'),
  ((select id from ingredients where slug = 'honey' and owner_id is null), 'fr'::app_locale, 'Miel');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'pine-nuts' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'pine-nuts' and owner_id is null), 'ru'::app_locale, 'пиния'),
  ((select id from ingredients where slug = 'pine-nuts' and owner_id is null), 'ru'::app_locale, 'орехи кедровые'),
  ((select id from ingredients where slug = 'pine-nuts' and owner_id is null), 'en'::app_locale, 'pinoli'),
  ((select id from ingredients where slug = 'pine-nuts' and owner_id is null), 'en'::app_locale, 'pignoli'),
  ((select id from ingredients where slug = 'pine-nuts' and owner_id is null), 'fr'::app_locale, 'pignons'),
  ((select id from ingredients where slug = 'pine-nuts' and owner_id is null), 'ru'::app_locale, 'Кедровые орехи'),
  ((select id from ingredients where slug = 'pine-nuts' and owner_id is null), 'en'::app_locale, 'Pine nuts'),
  ((select id from ingredients where slug = 'pine-nuts' and owner_id is null), 'fr'::app_locale, 'Pignons de pin');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'flour-type-00' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'flour-type-00' and owner_id is null), 'ru'::app_locale, 'мука 00'),
  ((select id from ingredients where slug = 'flour-type-00' and owner_id is null), 'ru'::app_locale, 'мука для пиццы'),
  ((select id from ingredients where slug = 'flour-type-00' and owner_id is null), 'en'::app_locale, '00 flour'),
  ((select id from ingredients where slug = 'flour-type-00' and owner_id is null), 'en'::app_locale, 'tipo 00'),
  ((select id from ingredients where slug = 'flour-type-00' and owner_id is null), 'en'::app_locale, 'doppio zero'),
  ((select id from ingredients where slug = 'flour-type-00' and owner_id is null), 'fr'::app_locale, 'farine 00'),
  ((select id from ingredients where slug = 'flour-type-00' and owner_id is null), 'fr'::app_locale, 'farine tipo 00'),
  ((select id from ingredients where slug = 'flour-type-00' and owner_id is null), 'ru'::app_locale, 'Мука типа 00'),
  ((select id from ingredients where slug = 'flour-type-00' and owner_id is null), 'en'::app_locale, 'Type 00 flour'),
  ((select id from ingredients where slug = 'flour-type-00' and owner_id is null), 'fr'::app_locale, 'Farine type 00');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'flour-type-0' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'flour-type-0' and owner_id is null), 'ru'::app_locale, 'мука 0'),
  ((select id from ingredients where slug = 'flour-type-0' and owner_id is null), 'en'::app_locale, '0 flour'),
  ((select id from ingredients where slug = 'flour-type-0' and owner_id is null), 'en'::app_locale, 'tipo 0'),
  ((select id from ingredients where slug = 'flour-type-0' and owner_id is null), 'fr'::app_locale, 'farine 0'),
  ((select id from ingredients where slug = 'flour-type-0' and owner_id is null), 'ru'::app_locale, 'Мука типа 0'),
  ((select id from ingredients where slug = 'flour-type-0' and owner_id is null), 'en'::app_locale, 'Type 0 flour'),
  ((select id from ingredients where slug = 'flour-type-0' and owner_id is null), 'fr'::app_locale, 'Farine type 0');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'flour-pinsa' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'flour-pinsa' and owner_id is null), 'ru'::app_locale, 'мука пинса'),
  ((select id from ingredients where slug = 'flour-pinsa' and owner_id is null), 'en'::app_locale, 'pinsa blend'),
  ((select id from ingredients where slug = 'flour-pinsa' and owner_id is null), 'en'::app_locale, 'molino signetti pinsa'),
  ((select id from ingredients where slug = 'flour-pinsa' and owner_id is null), 'fr'::app_locale, 'farine pinsa'),
  ((select id from ingredients where slug = 'flour-pinsa' and owner_id is null), 'ru'::app_locale, 'Мука для пинсы'),
  ((select id from ingredients where slug = 'flour-pinsa' and owner_id is null), 'en'::app_locale, 'Pinsa flour'),
  ((select id from ingredients where slug = 'flour-pinsa' and owner_id is null), 'fr'::app_locale, 'Farine à pinsa');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'yeast-active-dry' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'yeast-active-dry' and owner_id is null), 'ru'::app_locale, 'дрожжи сухие'),
  ((select id from ingredients where slug = 'yeast-active-dry' and owner_id is null), 'ru'::app_locale, 'дрожжи'),
  ((select id from ingredients where slug = 'yeast-active-dry' and owner_id is null), 'en'::app_locale, 'ady'),
  ((select id from ingredients where slug = 'yeast-active-dry' and owner_id is null), 'en'::app_locale, 'dry yeast'),
  ((select id from ingredients where slug = 'yeast-active-dry' and owner_id is null), 'en'::app_locale, 'yeast'),
  ((select id from ingredients where slug = 'yeast-active-dry' and owner_id is null), 'fr'::app_locale, 'levure sèche'),
  ((select id from ingredients where slug = 'yeast-active-dry' and owner_id is null), 'fr'::app_locale, 'levure'),
  ((select id from ingredients where slug = 'yeast-active-dry' and owner_id is null), 'ru'::app_locale, 'Сухие активные дрожжи'),
  ((select id from ingredients where slug = 'yeast-active-dry' and owner_id is null), 'en'::app_locale, 'Active dry yeast'),
  ((select id from ingredients where slug = 'yeast-active-dry' and owner_id is null), 'fr'::app_locale, 'Levure sèche active');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'mozzarella' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'mozzarella' and owner_id is null), 'ru'::app_locale, 'моцарела'),
  ((select id from ingredients where slug = 'mozzarella' and owner_id is null), 'en'::app_locale, 'mozzarella cheese'),
  ((select id from ingredients where slug = 'mozzarella' and owner_id is null), 'ru'::app_locale, 'Моцарелла'),
  ((select id from ingredients where slug = 'mozzarella' and owner_id is null), 'en'::app_locale, 'Mozzarella'),
  ((select id from ingredients where slug = 'mozzarella' and owner_id is null), 'fr'::app_locale, 'Mozzarella');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null), 'ru'::app_locale, 'фиор ди латте'),
  ((select id from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null), 'ru'::app_locale, 'моцарелла коровья'),
  ((select id from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null), 'en'::app_locale, 'fior di latte'),
  ((select id from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null), 'en'::app_locale, 'cow milk mozzarella'),
  ((select id from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null), 'fr'::app_locale, 'fior di latte'),
  ((select id from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null), 'fr'::app_locale, 'mozzarella au lait de vache'),
  ((select id from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null), 'ru'::app_locale, 'Моцарелла фиор ди латте'),
  ((select id from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null), 'en'::app_locale, 'Mozzarella fior di latte'),
  ((select id from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null), 'fr'::app_locale, 'Mozzarella fior di latte');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'mozzarella-di-bufala' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'mozzarella-di-bufala' and owner_id is null), 'ru'::app_locale, 'буффала'),
  ((select id from ingredients where slug = 'mozzarella-di-bufala' and owner_id is null), 'ru'::app_locale, 'буйволиная моцарелла'),
  ((select id from ingredients where slug = 'mozzarella-di-bufala' and owner_id is null), 'ru'::app_locale, 'моцарелла из буйволиного молока'),
  ((select id from ingredients where slug = 'mozzarella-di-bufala' and owner_id is null), 'en'::app_locale, 'buffalo mozzarella'),
  ((select id from ingredients where slug = 'mozzarella-di-bufala' and owner_id is null), 'en'::app_locale, 'bufala'),
  ((select id from ingredients where slug = 'mozzarella-di-bufala' and owner_id is null), 'en'::app_locale, 'mozzarella di bufala campana'),
  ((select id from ingredients where slug = 'mozzarella-di-bufala' and owner_id is null), 'fr'::app_locale, 'mozzarella de bufflonne'),
  ((select id from ingredients where slug = 'mozzarella-di-bufala' and owner_id is null), 'fr'::app_locale, 'bufflonne'),
  ((select id from ingredients where slug = 'mozzarella-di-bufala' and owner_id is null), 'ru'::app_locale, 'Моцарелла ди буфала'),
  ((select id from ingredients where slug = 'mozzarella-di-bufala' and owner_id is null), 'en'::app_locale, 'Mozzarella di bufala'),
  ((select id from ingredients where slug = 'mozzarella-di-bufala' and owner_id is null), 'fr'::app_locale, 'Mozzarella di bufala');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'parmigiano-reggiano' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'parmigiano-reggiano' and owner_id is null), 'ru'::app_locale, 'пармиджано реджано'),
  ((select id from ingredients where slug = 'parmigiano-reggiano' and owner_id is null), 'ru'::app_locale, 'пармиджано'),
  ((select id from ingredients where slug = 'parmigiano-reggiano' and owner_id is null), 'en'::app_locale, 'parmigiano reggiano'),
  ((select id from ingredients where slug = 'parmigiano-reggiano' and owner_id is null), 'en'::app_locale, 'parmigiano'),
  ((select id from ingredients where slug = 'parmigiano-reggiano' and owner_id is null), 'en'::app_locale, 'parmesan cheese'),
  ((select id from ingredients where slug = 'parmigiano-reggiano' and owner_id is null), 'fr'::app_locale, 'parmigiano reggiano'),
  ((select id from ingredients where slug = 'parmigiano-reggiano' and owner_id is null), 'fr'::app_locale, 'parmigiano'),
  ((select id from ingredients where slug = 'parmigiano-reggiano' and owner_id is null), 'ru'::app_locale, 'Пармезан'),
  ((select id from ingredients where slug = 'parmigiano-reggiano' and owner_id is null), 'en'::app_locale, 'Parmesan'),
  ((select id from ingredients where slug = 'parmigiano-reggiano' and owner_id is null), 'fr'::app_locale, 'Parmesan');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'pecorino' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'pecorino' and owner_id is null), 'ru'::app_locale, 'пекорино романо'),
  ((select id from ingredients where slug = 'pecorino' and owner_id is null), 'en'::app_locale, 'pecorino romano'),
  ((select id from ingredients where slug = 'pecorino' and owner_id is null), 'fr'::app_locale, 'pécorino'),
  ((select id from ingredients where slug = 'pecorino' and owner_id is null), 'ru'::app_locale, 'Пекорино'),
  ((select id from ingredients where slug = 'pecorino' and owner_id is null), 'en'::app_locale, 'Pecorino'),
  ((select id from ingredients where slug = 'pecorino' and owner_id is null), 'fr'::app_locale, 'Pecorino');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'pecorino-sardo' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'pecorino-sardo' and owner_id is null), 'ru'::app_locale, 'сардинский пекорино'),
  ((select id from ingredients where slug = 'pecorino-sardo' and owner_id is null), 'en'::app_locale, 'sardinian pecorino'),
  ((select id from ingredients where slug = 'pecorino-sardo' and owner_id is null), 'fr'::app_locale, 'pécorino sarde'),
  ((select id from ingredients where slug = 'pecorino-sardo' and owner_id is null), 'ru'::app_locale, 'Пекорино Сардо'),
  ((select id from ingredients where slug = 'pecorino-sardo' and owner_id is null), 'en'::app_locale, 'Pecorino Sardo'),
  ((select id from ingredients where slug = 'pecorino-sardo' and owner_id is null), 'fr'::app_locale, 'Pecorino Sardo');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'fontal' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'fontal' and owner_id is null), 'ru'::app_locale, 'фонтал'),
  ((select id from ingredients where slug = 'fontal' and owner_id is null), 'en'::app_locale, 'fontal cheese'),
  ((select id from ingredients where slug = 'fontal' and owner_id is null), 'ru'::app_locale, 'Фонталь'),
  ((select id from ingredients where slug = 'fontal' and owner_id is null), 'en'::app_locale, 'Fontal'),
  ((select id from ingredients where slug = 'fontal' and owner_id is null), 'fr'::app_locale, 'Fontal');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'gorgonzola' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'gorgonzola' and owner_id is null), 'ru'::app_locale, 'горгондзола'),
  ((select id from ingredients where slug = 'gorgonzola' and owner_id is null), 'ru'::app_locale, 'горгонцола'),
  ((select id from ingredients where slug = 'gorgonzola' and owner_id is null), 'en'::app_locale, 'gorgonzola dolce'),
  ((select id from ingredients where slug = 'gorgonzola' and owner_id is null), 'en'::app_locale, 'blue cheese'),
  ((select id from ingredients where slug = 'gorgonzola' and owner_id is null), 'fr'::app_locale, 'gorgonzola doux'),
  ((select id from ingredients where slug = 'gorgonzola' and owner_id is null), 'ru'::app_locale, 'Горгонзола'),
  ((select id from ingredients where slug = 'gorgonzola' and owner_id is null), 'en'::app_locale, 'Gorgonzola'),
  ((select id from ingredients where slug = 'gorgonzola' and owner_id is null), 'fr'::app_locale, 'Gorgonzola');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'pepperoni' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'pepperoni' and owner_id is null), 'ru'::app_locale, 'пеперони'),
  ((select id from ingredients where slug = 'pepperoni' and owner_id is null), 'ru'::app_locale, 'колбаса пепперони'),
  ((select id from ingredients where slug = 'pepperoni' and owner_id is null), 'en'::app_locale, 'pepperoni sausage'),
  ((select id from ingredients where slug = 'pepperoni' and owner_id is null), 'fr'::app_locale, 'saucisson pepperoni'),
  ((select id from ingredients where slug = 'pepperoni' and owner_id is null), 'ru'::app_locale, 'Пепперони'),
  ((select id from ingredients where slug = 'pepperoni' and owner_id is null), 'en'::app_locale, 'Pepperoni'),
  ((select id from ingredients where slug = 'pepperoni' and owner_id is null), 'fr'::app_locale, 'Pepperoni');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'mortadella' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'mortadella' and owner_id is null), 'ru'::app_locale, 'мортадела'),
  ((select id from ingredients where slug = 'mortadella' and owner_id is null), 'en'::app_locale, 'mortadella bologna'),
  ((select id from ingredients where slug = 'mortadella' and owner_id is null), 'fr'::app_locale, 'mortadelle de bologne'),
  ((select id from ingredients where slug = 'mortadella' and owner_id is null), 'ru'::app_locale, 'Мортаделла'),
  ((select id from ingredients where slug = 'mortadella' and owner_id is null), 'en'::app_locale, 'Mortadella'),
  ((select id from ingredients where slug = 'mortadella' and owner_id is null), 'fr'::app_locale, 'Mortadelle');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'italian-sausage' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'italian-sausage' and owner_id is null), 'ru'::app_locale, 'салсичча'),
  ((select id from ingredients where slug = 'italian-sausage' and owner_id is null), 'ru'::app_locale, 'колбаска'),
  ((select id from ingredients where slug = 'italian-sausage' and owner_id is null), 'en'::app_locale, 'salsiccia'),
  ((select id from ingredients where slug = 'italian-sausage' and owner_id is null), 'en'::app_locale, 'sausage'),
  ((select id from ingredients where slug = 'italian-sausage' and owner_id is null), 'fr'::app_locale, 'salsiccia'),
  ((select id from ingredients where slug = 'italian-sausage' and owner_id is null), 'fr'::app_locale, 'saucisse'),
  ((select id from ingredients where slug = 'italian-sausage' and owner_id is null), 'ru'::app_locale, 'Итальянская колбаска'),
  ((select id from ingredients where slug = 'italian-sausage' and owner_id is null), 'en'::app_locale, 'Italian sausage'),
  ((select id from ingredients where slug = 'italian-sausage' and owner_id is null), 'fr'::app_locale, 'Saucisse italienne');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'nduja' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'nduja' and owner_id is null), 'ru'::app_locale, 'ндуя'),
  ((select id from ingredients where slug = 'nduja' and owner_id is null), 'en'::app_locale, 'nduja'),
  ((select id from ingredients where slug = 'nduja' and owner_id is null), 'fr'::app_locale, 'nduja'),
  ((select id from ingredients where slug = 'nduja' and owner_id is null), 'ru'::app_locale, 'Ндуйя'),
  ((select id from ingredients where slug = 'nduja' and owner_id is null), 'en'::app_locale, '''Nduja'),
  ((select id from ingredients where slug = 'nduja' and owner_id is null), 'fr'::app_locale, '''Nduja');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'soppressata' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'soppressata' and owner_id is null), 'ru'::app_locale, 'супрессата'),
  ((select id from ingredients where slug = 'soppressata' and owner_id is null), 'en'::app_locale, 'sopressata'),
  ((select id from ingredients where slug = 'soppressata' and owner_id is null), 'ru'::app_locale, 'Соппрессата'),
  ((select id from ingredients where slug = 'soppressata' and owner_id is null), 'en'::app_locale, 'Soppressata'),
  ((select id from ingredients where slug = 'soppressata' and owner_id is null), 'fr'::app_locale, 'Soppressata');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'basil-fresh' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'basil-fresh' and owner_id is null), 'ru'::app_locale, 'базилик'),
  ((select id from ingredients where slug = 'basil-fresh' and owner_id is null), 'ru'::app_locale, 'зелёный базилик'),
  ((select id from ingredients where slug = 'basil-fresh' and owner_id is null), 'en'::app_locale, 'basil'),
  ((select id from ingredients where slug = 'basil-fresh' and owner_id is null), 'en'::app_locale, 'genovese basil'),
  ((select id from ingredients where slug = 'basil-fresh' and owner_id is null), 'en'::app_locale, 'sweet basil'),
  ((select id from ingredients where slug = 'basil-fresh' and owner_id is null), 'fr'::app_locale, 'basilic'),
  ((select id from ingredients where slug = 'basil-fresh' and owner_id is null), 'fr'::app_locale, 'basilic génois'),
  ((select id from ingredients where slug = 'basil-fresh' and owner_id is null), 'ru'::app_locale, 'Базилик свежий'),
  ((select id from ingredients where slug = 'basil-fresh' and owner_id is null), 'en'::app_locale, 'Fresh basil'),
  ((select id from ingredients where slug = 'basil-fresh' and owner_id is null), 'fr'::app_locale, 'Basilic frais');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'garlic' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'garlic' and owner_id is null), 'ru'::app_locale, 'чеснок свежий'),
  ((select id from ingredients where slug = 'garlic' and owner_id is null), 'en'::app_locale, 'garlic clove'),
  ((select id from ingredients where slug = 'garlic' and owner_id is null), 'fr'::app_locale, 'gousse d''ail'),
  ((select id from ingredients where slug = 'garlic' and owner_id is null), 'ru'::app_locale, 'Чеснок'),
  ((select id from ingredients where slug = 'garlic' and owner_id is null), 'en'::app_locale, 'Garlic'),
  ((select id from ingredients where slug = 'garlic' and owner_id is null), 'fr'::app_locale, 'Ail');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'arugula' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'arugula' and owner_id is null), 'ru'::app_locale, 'рукола'),
  ((select id from ingredients where slug = 'arugula' and owner_id is null), 'ru'::app_locale, 'рукколла'),
  ((select id from ingredients where slug = 'arugula' and owner_id is null), 'en'::app_locale, 'rocket'),
  ((select id from ingredients where slug = 'arugula' and owner_id is null), 'en'::app_locale, 'rucola'),
  ((select id from ingredients where slug = 'arugula' and owner_id is null), 'en'::app_locale, 'roquette'),
  ((select id from ingredients where slug = 'arugula' and owner_id is null), 'en'::app_locale, 'arugula'),
  ((select id from ingredients where slug = 'arugula' and owner_id is null), 'fr'::app_locale, 'roquette'),
  ((select id from ingredients where slug = 'arugula' and owner_id is null), 'fr'::app_locale, 'rucola'),
  ((select id from ingredients where slug = 'arugula' and owner_id is null), 'ru'::app_locale, 'Руккола'),
  ((select id from ingredients where slug = 'arugula' and owner_id is null), 'en'::app_locale, 'Arugula'),
  ((select id from ingredients where slug = 'arugula' and owner_id is null), 'fr'::app_locale, 'Roquette');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'pear' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'pear' and owner_id is null), 'ru'::app_locale, 'груши'),
  ((select id from ingredients where slug = 'pear' and owner_id is null), 'en'::app_locale, 'pears'),
  ((select id from ingredients where slug = 'pear' and owner_id is null), 'fr'::app_locale, 'poires'),
  ((select id from ingredients where slug = 'pear' and owner_id is null), 'ru'::app_locale, 'Груша'),
  ((select id from ingredients where slug = 'pear' and owner_id is null), 'en'::app_locale, 'Pear'),
  ((select id from ingredients where slug = 'pear' and owner_id is null), 'fr'::app_locale, 'Poire');
delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = 'chili-flakes' and owner_id is null);
insert into ingredient_aliases (ingredient_id, locale, alias) values
  ((select id from ingredients where slug = 'chili-flakes' and owner_id is null), 'ru'::app_locale, 'перец чили'),
  ((select id from ingredients where slug = 'chili-flakes' and owner_id is null), 'ru'::app_locale, 'острый перец'),
  ((select id from ingredients where slug = 'chili-flakes' and owner_id is null), 'en'::app_locale, 'red pepper flakes'),
  ((select id from ingredients where slug = 'chili-flakes' and owner_id is null), 'en'::app_locale, 'peperoncino'),
  ((select id from ingredients where slug = 'chili-flakes' and owner_id is null), 'fr'::app_locale, 'piment'),
  ((select id from ingredients where slug = 'chili-flakes' and owner_id is null), 'fr'::app_locale, 'peperoncino'),
  ((select id from ingredients where slug = 'chili-flakes' and owner_id is null), 'ru'::app_locale, 'Хлопья острого перца'),
  ((select id from ingredients where slug = 'chili-flakes' and owner_id is null), 'en'::app_locale, 'Chili flakes'),
  ((select id from ingredients where slug = 'chili-flakes' and owner_id is null), 'fr'::app_locale, 'Flocons de piment');

-- ---------------------------------------------------------------------------
-- Package options and substitutions
-- ---------------------------------------------------------------------------
insert into ingredient_package_options (owner_id, slug, ingredient_id, package_type, net_quantity, unit, brand, barcode, source_url, preferred)
select null, 'pkg-pelati-400', i.id, 'can'::package_type, 400, 'g'::unit_code, null, null, null, true
from ingredients i where i.slug = 'tomatoes-whole-peeled-canned' and i.owner_id is null
  on conflict (slug) where owner_id is null do update set
    net_quantity = excluded.net_quantity,
    unit = excluded.unit,
    preferred = excluded.preferred;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'ru', 'Банка 400 г' from ingredient_package_options where slug = 'pkg-pelati-400' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'en', '400 g can' from ingredient_package_options where slug = 'pkg-pelati-400' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'fr', 'Boîte 400 g' from ingredient_package_options where slug = 'pkg-pelati-400' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_options (owner_id, slug, ingredient_id, package_type, net_quantity, unit, brand, barcode, source_url, preferred)
select null, 'pkg-pelati-800', i.id, 'can'::package_type, 800, 'g'::unit_code, null, null, null, false
from ingredients i where i.slug = 'tomatoes-whole-peeled-canned' and i.owner_id is null
  on conflict (slug) where owner_id is null do update set
    net_quantity = excluded.net_quantity,
    unit = excluded.unit,
    preferred = excluded.preferred;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'ru', 'Банка 800 г' from ingredient_package_options where slug = 'pkg-pelati-800' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'en', '800 g can' from ingredient_package_options where slug = 'pkg-pelati-800' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'fr', 'Boîte 800 g' from ingredient_package_options where slug = 'pkg-pelati-800' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_options (owner_id, slug, ingredient_id, package_type, net_quantity, unit, brand, barcode, source_url, preferred)
select null, 'pkg-mozzarella-125', i.id, 'pack'::package_type, 125, 'g'::unit_code, null, null, null, true
from ingredients i where i.slug = 'mozzarella-fior-di-latte' and i.owner_id is null
  on conflict (slug) where owner_id is null do update set
    net_quantity = excluded.net_quantity,
    unit = excluded.unit,
    preferred = excluded.preferred;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'ru', 'Шарик 125 г' from ingredient_package_options where slug = 'pkg-mozzarella-125' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'en', '125 g ball' from ingredient_package_options where slug = 'pkg-mozzarella-125' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'fr', 'Boule 125 g' from ingredient_package_options where slug = 'pkg-mozzarella-125' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_options (owner_id, slug, ingredient_id, package_type, net_quantity, unit, brand, barcode, source_url, preferred)
select null, 'pkg-bufala-125', i.id, 'pack'::package_type, 125, 'g'::unit_code, null, null, null, true
from ingredients i where i.slug = 'mozzarella-di-bufala' and i.owner_id is null
  on conflict (slug) where owner_id is null do update set
    net_quantity = excluded.net_quantity,
    unit = excluded.unit,
    preferred = excluded.preferred;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'ru', 'Шарик 125 г' from ingredient_package_options where slug = 'pkg-bufala-125' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'en', '125 g ball' from ingredient_package_options where slug = 'pkg-bufala-125' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'fr', 'Boule 125 g' from ingredient_package_options where slug = 'pkg-bufala-125' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_options (owner_id, slug, ingredient_id, package_type, net_quantity, unit, brand, barcode, source_url, preferred)
select null, 'pkg-evoo-500', i.id, 'bottle'::package_type, 500, 'ml'::unit_code, null, null, null, true
from ingredients i where i.slug = 'olive-oil-extra-virgin' and i.owner_id is null
  on conflict (slug) where owner_id is null do update set
    net_quantity = excluded.net_quantity,
    unit = excluded.unit,
    preferred = excluded.preferred;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'ru', 'Бутылка 500 мл' from ingredient_package_options where slug = 'pkg-evoo-500' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'en', '500 ml bottle' from ingredient_package_options where slug = 'pkg-evoo-500' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'fr', 'Bouteille 500 ml' from ingredient_package_options where slug = 'pkg-evoo-500' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_options (owner_id, slug, ingredient_id, package_type, net_quantity, unit, brand, barcode, source_url, preferred)
select null, 'pkg-flour-00-1kg', i.id, 'bag'::package_type, 1, 'kg'::unit_code, null, null, null, true
from ingredients i where i.slug = 'flour-type-00' and i.owner_id is null
  on conflict (slug) where owner_id is null do update set
    net_quantity = excluded.net_quantity,
    unit = excluded.unit,
    preferred = excluded.preferred;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'ru', 'Пакет 1 кг' from ingredient_package_options where slug = 'pkg-flour-00-1kg' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'en', '1 kg bag' from ingredient_package_options where slug = 'pkg-flour-00-1kg' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'fr', 'Sachet 1 kg' from ingredient_package_options where slug = 'pkg-flour-00-1kg' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_options (owner_id, slug, ingredient_id, package_type, net_quantity, unit, brand, barcode, source_url, preferred)
select null, 'pkg-flour-0-1kg', i.id, 'bag'::package_type, 1, 'kg'::unit_code, null, null, null, true
from ingredients i where i.slug = 'flour-type-0' and i.owner_id is null
  on conflict (slug) where owner_id is null do update set
    net_quantity = excluded.net_quantity,
    unit = excluded.unit,
    preferred = excluded.preferred;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'ru', 'Пакет 1 кг' from ingredient_package_options where slug = 'pkg-flour-0-1kg' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'en', '1 kg bag' from ingredient_package_options where slug = 'pkg-flour-0-1kg' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'fr', 'Sachet 1 kg' from ingredient_package_options where slug = 'pkg-flour-0-1kg' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_options (owner_id, slug, ingredient_id, package_type, net_quantity, unit, brand, barcode, source_url, preferred)
select null, 'pkg-yeast-7', i.id, 'pack'::package_type, 7, 'g'::unit_code, null, null, null, true
from ingredients i where i.slug = 'yeast-active-dry' and i.owner_id is null
  on conflict (slug) where owner_id is null do update set
    net_quantity = excluded.net_quantity,
    unit = excluded.unit,
    preferred = excluded.preferred;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'ru', 'Пакетик 7 г' from ingredient_package_options where slug = 'pkg-yeast-7' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'en', '7 g sachet' from ingredient_package_options where slug = 'pkg-yeast-7' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'fr', 'Sachet 7 g' from ingredient_package_options where slug = 'pkg-yeast-7' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_options (owner_id, slug, ingredient_id, package_type, net_quantity, unit, brand, barcode, source_url, preferred)
select null, 'pkg-pine-nuts-100', i.id, 'pack'::package_type, 100, 'g'::unit_code, null, null, null, true
from ingredients i where i.slug = 'pine-nuts' and i.owner_id is null
  on conflict (slug) where owner_id is null do update set
    net_quantity = excluded.net_quantity,
    unit = excluded.unit,
    preferred = excluded.preferred;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'ru', 'Упаковка 100 г' from ingredient_package_options where slug = 'pkg-pine-nuts-100' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'en', '100 g pack' from ingredient_package_options where slug = 'pkg-pine-nuts-100' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'fr', 'Sachet 100 g' from ingredient_package_options where slug = 'pkg-pine-nuts-100' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_options (owner_id, slug, ingredient_id, package_type, net_quantity, unit, brand, barcode, source_url, preferred)
select null, 'pkg-parmesan-200', i.id, 'pack'::package_type, 200, 'g'::unit_code, null, null, null, true
from ingredients i where i.slug = 'parmigiano-reggiano' and i.owner_id is null
  on conflict (slug) where owner_id is null do update set
    net_quantity = excluded.net_quantity,
    unit = excluded.unit,
    preferred = excluded.preferred;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'ru', 'Кусок 200 г' from ingredient_package_options where slug = 'pkg-parmesan-200' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'en', '200 g piece' from ingredient_package_options where slug = 'pkg-parmesan-200' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'fr', 'Morceau 200 g' from ingredient_package_options where slug = 'pkg-parmesan-200' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_options (owner_id, slug, ingredient_id, package_type, net_quantity, unit, brand, barcode, source_url, preferred)
select null, 'pkg-arugula-125', i.id, 'bag'::package_type, 125, 'g'::unit_code, null, null, null, true
from ingredients i where i.slug = 'arugula' and i.owner_id is null
  on conflict (slug) where owner_id is null do update set
    net_quantity = excluded.net_quantity,
    unit = excluded.unit,
    preferred = excluded.preferred;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'ru', 'Пакет 125 г' from ingredient_package_options where slug = 'pkg-arugula-125' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'en', '125 g bag' from ingredient_package_options where slug = 'pkg-arugula-125' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;
insert into ingredient_package_option_translations (package_option_id, locale, label) select id, 'fr', 'Sachet 125 g' from ingredient_package_options where slug = 'pkg-arugula-125' and owner_id is null
  on conflict (package_option_id, locale) do update set label = excluded.label;

-- Substitutions, including the deliberately unapproved rows that exist so
-- the UI can explain why a swap is refused.
delete from ingredient_substitutions where owner_id is null;
with inserted as (
  insert into ingredient_substitutions (owner_id, from_ingredient_id, to_ingredient_id, style_id, quality_grade, approved)
  select null,
    (select id from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null),
    (select id from ingredients where slug = 'mozzarella-di-bufala' and owner_id is null),
    null,
    'equivalent'::substitution_grade,
    true
  returning id
)
insert into ingredient_substitution_translations (substitution_id, locale, explanation)
select inserted.id, locale, explanation from inserted
cross join (values
  ('ru'::app_locale, 'Буфала более влажная и насыщенная; подсушите её перед выпечкой.'),
  ('en'::app_locale, 'Bufala is wetter and richer; drain it well before baking.'),
  ('fr'::app_locale, 'La bufflonne est plus humide; égouttez-la bien avant la cuisson.')
) as t(locale, explanation);
with inserted as (
  insert into ingredient_substitutions (owner_id, from_ingredient_id, to_ingredient_id, style_id, quality_grade, approved)
  select null,
    (select id from ingredients where slug = 'mozzarella-di-bufala' and owner_id is null),
    (select id from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null),
    null,
    'equivalent'::substitution_grade,
    true
  returning id
)
insert into ingredient_substitution_translations (substitution_id, locale, explanation)
select inserted.id, locale, explanation from inserted
cross join (values
  ('ru'::app_locale, 'Фиор ди латте суше и стабильнее в домашней духовке.'),
  ('en'::app_locale, 'Fior di latte is drier and behaves better in a home oven.'),
  ('fr'::app_locale, 'Le fior di latte est plus sec et tient mieux au four domestique.')
) as t(locale, explanation);
with inserted as (
  insert into ingredient_substitutions (owner_id, from_ingredient_id, to_ingredient_id, style_id, quality_grade, approved)
  select null,
    (select id from ingredients where slug = 'pecorino-sardo' and owner_id is null),
    (select id from ingredients where slug = 'pecorino' and owner_id is null),
    null,
    'good'::substitution_grade,
    true
  returning id
)
insert into ingredient_substitution_translations (substitution_id, locale, explanation)
select inserted.id, locale, explanation from inserted
cross join (values
  ('ru'::app_locale, 'Пекорино Романо солонее — уменьшите количество соли.'),
  ('en'::app_locale, 'Pecorino Romano is saltier, so cut back on added salt.'),
  ('fr'::app_locale, 'Le pecorino romano est plus salé; réduisez le sel ajouté.')
) as t(locale, explanation);
with inserted as (
  insert into ingredient_substitutions (owner_id, from_ingredient_id, to_ingredient_id, style_id, quality_grade, approved)
  select null,
    (select id from ingredients where slug = 'pepperoni' and owner_id is null),
    (select id from ingredients where slug = 'soppressata' and owner_id is null),
    null,
    'good'::substitution_grade,
    true
  returning id
)
insert into ingredient_substitution_translations (substitution_id, locale, explanation)
select inserted.id, locale, explanation from inserted
cross join (values
  ('ru'::app_locale, 'Соппрессата даёт схожий пряный профиль и хорошо подрумянивается.'),
  ('en'::app_locale, 'Soppressata gives a comparable spiced profile and crisps well.'),
  ('fr'::app_locale, 'La soppressata offre un profil épicé comparable et croustille bien.')
) as t(locale, explanation);
with inserted as (
  insert into ingredient_substitutions (owner_id, from_ingredient_id, to_ingredient_id, style_id, quality_grade, approved)
  select null,
    (select id from ingredients where slug = 'pepperoni' and owner_id is null),
    (select id from ingredients where slug = 'nduja' and owner_id is null),
    null,
    'acceptable'::substitution_grade,
    true
  returning id
)
insert into ingredient_substitution_translations (substitution_id, locale, explanation)
select inserted.id, locale, explanation from inserted
cross join (values
  ('ru'::app_locale, 'Ндуйя намного острее и мягче по текстуре — кладите меньше.'),
  ('en'::app_locale, '''Nduja is far spicier and spreadable, so use noticeably less.'),
  ('fr'::app_locale, 'La ''nduja est bien plus piquante et tartinable; dosez moins.')
) as t(locale, explanation);
with inserted as (
  insert into ingredient_substitutions (owner_id, from_ingredient_id, to_ingredient_id, style_id, quality_grade, approved)
  select null,
    (select id from ingredients where slug = 'flour-type-00' and owner_id is null),
    (select id from ingredients where slug = 'flour-type-0' and owner_id is null),
    null,
    'good'::substitution_grade,
    true
  returning id
)
insert into ingredient_substitution_translations (substitution_id, locale, explanation)
select inserted.id, locale, explanation from inserted
cross join (values
  ('ru'::app_locale, 'Мука типа 0 немного грубее и впитывает чуть больше воды.'),
  ('en'::app_locale, 'Type 0 is slightly coarser and takes a little more water.'),
  ('fr'::app_locale, 'La type 0 est un peu plus rustique et absorbe un peu plus d’eau.')
) as t(locale, explanation);
with inserted as (
  insert into ingredient_substitutions (owner_id, from_ingredient_id, to_ingredient_id, style_id, quality_grade, approved)
  select null,
    (select id from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null),
    (select id from ingredients where slug = 'chili-flakes' and owner_id is null),
    null,
    'last_resort'::substitution_grade,
    false
  returning id
)
insert into ingredient_substitution_translations (substitution_id, locale, explanation)
select inserted.id, locale, explanation from inserted
cross join (values
  ('ru'::app_locale, 'Не замена: без томатов лучше добавить их в список покупок.'),
  ('en'::app_locale, 'Not a substitute: if there are no tomatoes, add them to the shopping list.'),
  ('fr'::app_locale, 'Pas un substitut : sans tomates, ajoutez-en à la liste de courses.')
) as t(locale, explanation);

-- ---------------------------------------------------------------------------
-- Recipes
--
-- Components are inserted before the pizzas that reference them, so the
-- component lookups below always resolve.
-- ---------------------------------------------------------------------------

-- Evidence is rebuilt from scratch on every run.
delete from field_evidence where owner_id = :owner_id and entity_type in ('recipe', 'recipe_item');

-- tomato-sauce-user
insert into recipes (owner_id, slug, type, status, authenticity, style_id, oven_profile_id, origin_locale,
  base_yield, yield_unit, base_diameter_mm, base_shape, base_tray_width_mm, base_tray_height_mm,
  base_ball_weight_g, active_minutes, passive_minutes, difficulty, tags)
values (
  :owner_id, 'tomato-sauce-user', 'sauce'::recipe_type, 'needs_review'::recipe_status,
  'user_verified'::authenticity_class,
  null,
  null,
  'ru'::app_locale,
  null, 'g'::unit_code,
  null, null,
  null, null,
  null, 10, 0,
  1, ARRAY['raw', 'no-cook']::text[]
)
on conflict (owner_id, slug) do update set
  type = excluded.type,
  status = excluded.status,
  authenticity = excluded.authenticity,
  style_id = excluded.style_id,
  oven_profile_id = excluded.oven_profile_id,
  origin_locale = excluded.origin_locale,
  base_yield = excluded.base_yield,
  yield_unit = excluded.yield_unit,
  base_diameter_mm = excluded.base_diameter_mm,
  base_shape = excluded.base_shape,
  base_tray_width_mm = excluded.base_tray_width_mm,
  base_tray_height_mm = excluded.base_tray_height_mm,
  base_ball_weight_g = excluded.base_ball_weight_g,
  active_minutes = excluded.active_minutes,
  passive_minutes = excluded.passive_minutes,
  difficulty = excluded.difficulty,
  tags = excluded.tags;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'ru', 'Томатный соус для пиццы', 'Сырой неварёный соус: только томаты, базилик, соль и оливковое масло.', 'Выход зависит от веса банки — задайте упаковку, чтобы рассчитать его.' from recipes where slug = 'tomato-sauce-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'en', 'Pizza Tomato Sauce', 'A raw, uncooked sauce: tomatoes, basil, salt and olive oil, nothing else.', 'The yield depends on the can size — set the package to calculate it.' from recipes where slug = 'tomato-sauce-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'fr', 'Sauce tomate pour pizza', 'Une sauce crue, non cuite : tomates, basilic, sel et huile d’olive.', 'Le rendement dépend de la boîte — choisissez l’emballage pour le calculer.' from recipes where slug = 'tomato-sauce-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
-- pesto-genovese-user
insert into recipes (owner_id, slug, type, status, authenticity, style_id, oven_profile_id, origin_locale,
  base_yield, yield_unit, base_diameter_mm, base_shape, base_tray_width_mm, base_tray_height_mm,
  base_ball_weight_g, active_minutes, passive_minutes, difficulty, tags)
values (
  :owner_id, 'pesto-genovese-user', 'prep'::recipe_type, 'needs_review'::recipe_status,
  'user_verified'::authenticity_class,
  null,
  null,
  'ru'::app_locale,
  160, 'g'::unit_code,
  null, null,
  null, null,
  null, 20, null,
  2, '{}'
)
on conflict (owner_id, slug) do update set
  type = excluded.type,
  status = excluded.status,
  authenticity = excluded.authenticity,
  style_id = excluded.style_id,
  oven_profile_id = excluded.oven_profile_id,
  origin_locale = excluded.origin_locale,
  base_yield = excluded.base_yield,
  yield_unit = excluded.yield_unit,
  base_diameter_mm = excluded.base_diameter_mm,
  base_shape = excluded.base_shape,
  base_tray_width_mm = excluded.base_tray_width_mm,
  base_tray_height_mm = excluded.base_tray_height_mm,
  base_ball_weight_g = excluded.base_ball_weight_g,
  active_minutes = excluded.active_minutes,
  passive_minutes = excluded.passive_minutes,
  difficulty = excluded.difficulty,
  tags = excluded.tags;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'ru', 'Песто дженовезе', 'Классическое песто владельца. Заявленный выход конфликтует с массой ингредиентов.', null from recipes where slug = 'pesto-genovese-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'en', 'Pesto Genovese', 'The owner''s pesto. The stated yield conflicts with the ingredient masses.', null from recipes where slug = 'pesto-genovese-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'fr', 'Pesto genovese', 'Le pesto du propriétaire. Le rendement annoncé contredit la masse des ingrédients.', null from recipes where slug = 'pesto-genovese-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
-- arrabbiata-sauce-user
insert into recipes (owner_id, slug, type, status, authenticity, style_id, oven_profile_id, origin_locale,
  base_yield, yield_unit, base_diameter_mm, base_shape, base_tray_width_mm, base_tray_height_mm,
  base_ball_weight_g, active_minutes, passive_minutes, difficulty, tags)
values (
  :owner_id, 'arrabbiata-sauce-user', 'sauce'::recipe_type, 'needs_review'::recipe_status,
  'user_verified'::authenticity_class,
  null,
  null,
  'ru'::app_locale,
  null, 'g'::unit_code,
  null, null,
  null, null,
  null, null, null,
  2, '{}'
)
on conflict (owner_id, slug) do update set
  type = excluded.type,
  status = excluded.status,
  authenticity = excluded.authenticity,
  style_id = excluded.style_id,
  oven_profile_id = excluded.oven_profile_id,
  origin_locale = excluded.origin_locale,
  base_yield = excluded.base_yield,
  yield_unit = excluded.yield_unit,
  base_diameter_mm = excluded.base_diameter_mm,
  base_shape = excluded.base_shape,
  base_tray_width_mm = excluded.base_tray_width_mm,
  base_tray_height_mm = excluded.base_tray_height_mm,
  base_ball_weight_g = excluded.base_ball_weight_g,
  active_minutes = excluded.active_minutes,
  passive_minutes = excluded.passive_minutes,
  difficulty = excluded.difficulty,
  tags = excluded.tags;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'ru', 'Соус аррабьята', 'Острый томатный соус. Пропорции ещё не записаны.', null from recipes where slug = 'arrabbiata-sauce-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'en', 'Arrabbiata sauce', 'A spicy tomato sauce. The proportions have not been written down yet.', null from recipes where slug = 'arrabbiata-sauce-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'fr', 'Sauce arrabbiata', 'Une sauce tomate piquante. Les proportions ne sont pas encore notées.', null from recipes where slug = 'arrabbiata-sauce-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
-- sisofo-forgotten-neapolitan
insert into recipes (owner_id, slug, type, status, authenticity, style_id, oven_profile_id, origin_locale,
  base_yield, yield_unit, base_diameter_mm, base_shape, base_tray_width_mm, base_tray_height_mm,
  base_ball_weight_g, active_minutes, passive_minutes, difficulty, tags)
values (
  :owner_id, 'sisofo-forgotten-neapolitan', 'dough'::recipe_type, 'needs_review'::recipe_status,
  'pizzaiolo'::authenticity_class,
  (select id from styles where slug = 'napoletana'),
  (select id from oven_profiles where slug = 'home-oven-steel' and owner_id is null),
  'en'::app_locale,
  3, 'piece'::unit_code,
  null, null,
  null, null,
  281, 40, 1440,
  3, ARRAY['direct', 'room-temperature']::text[]
)
on conflict (owner_id, slug) do update set
  type = excluded.type,
  status = excluded.status,
  authenticity = excluded.authenticity,
  style_id = excluded.style_id,
  oven_profile_id = excluded.oven_profile_id,
  origin_locale = excluded.origin_locale,
  base_yield = excluded.base_yield,
  yield_unit = excluded.yield_unit,
  base_diameter_mm = excluded.base_diameter_mm,
  base_shape = excluded.base_shape,
  base_tray_width_mm = excluded.base_tray_width_mm,
  base_tray_height_mm = excluded.base_tray_height_mm,
  base_ball_weight_g = excluded.base_ball_weight_g,
  active_minutes = excluded.active_minutes,
  passive_minutes = excluded.passive_minutes,
  difficulty = excluded.difficulty,
  tags = excluded.tags;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'ru', 'Забытый стиль неаполитанской пиццы', 'Прямое тесто, около 24 часов при комнатной температуре, на 3 пиццы.', null from recipes where slug = 'sisofo-forgotten-neapolitan' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'en', 'The Forgotten Style of Neapolitan Pizza', 'A direct dough fermented about 24 hours at room temperature, for 3 pizzas.', null from recipes where slug = 'sisofo-forgotten-neapolitan' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'fr', 'Le style oublié de la pizza napolitaine', 'Une pâte directe, environ 24 h à température ambiante, pour 3 pizzas.', null from recipes where slug = 'sisofo-forgotten-neapolitan' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
-- sisofo-crispiest-teglia
insert into recipes (owner_id, slug, type, status, authenticity, style_id, oven_profile_id, origin_locale,
  base_yield, yield_unit, base_diameter_mm, base_shape, base_tray_width_mm, base_tray_height_mm,
  base_ball_weight_g, active_minutes, passive_minutes, difficulty, tags)
values (
  :owner_id, 'sisofo-crispiest-teglia', 'dough'::recipe_type, 'needs_review'::recipe_status,
  'pizzaiolo'::authenticity_class,
  (select id from styles where slug = 'romana-teglia'),
  (select id from oven_profiles where slug = 'home-oven' and owner_id is null),
  'en'::app_locale,
  2, 'piece'::unit_code,
  null, 'rectangular'::pizza_shape,
  406, 305,
  690, null, null,
  4, ARRAY['biga', 'pan']::text[]
)
on conflict (owner_id, slug) do update set
  type = excluded.type,
  status = excluded.status,
  authenticity = excluded.authenticity,
  style_id = excluded.style_id,
  oven_profile_id = excluded.oven_profile_id,
  origin_locale = excluded.origin_locale,
  base_yield = excluded.base_yield,
  yield_unit = excluded.yield_unit,
  base_diameter_mm = excluded.base_diameter_mm,
  base_shape = excluded.base_shape,
  base_tray_width_mm = excluded.base_tray_width_mm,
  base_tray_height_mm = excluded.base_tray_height_mm,
  base_ball_weight_g = excluded.base_ball_weight_g,
  active_minutes = excluded.active_minutes,
  passive_minutes = excluded.passive_minutes,
  difficulty = excluded.difficulty,
  tags = excluded.tags;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'ru', 'Самая хрустящая пицца, которую вы не готовили', 'Римская пицца в противне на биге: два противня 16×12 дюймов, примерно по 690 г теста.', null from recipes where slug = 'sisofo-crispiest-teglia' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'en', 'The Crispiest Pizza You''ve Never Made', 'Roman pizza in teglia built on a biga: two 16x12 inch trays, about 690 g of dough each.', null from recipes where slug = 'sisofo-crispiest-teglia' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'fr', 'La pizza la plus croustillante que vous n’avez jamais faite', 'Pizza romaine en plaque sur biga : deux plaques de 16×12 pouces, environ 690 g chacune.', null from recipes where slug = 'sisofo-crispiest-teglia' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
-- sisofo-roman-thin-crust
insert into recipes (owner_id, slug, type, status, authenticity, style_id, oven_profile_id, origin_locale,
  base_yield, yield_unit, base_diameter_mm, base_shape, base_tray_width_mm, base_tray_height_mm,
  base_ball_weight_g, active_minutes, passive_minutes, difficulty, tags)
values (
  :owner_id, 'sisofo-roman-thin-crust', 'dough'::recipe_type, 'needs_review'::recipe_status,
  'pizzaiolo'::authenticity_class,
  (select id from styles where slug = 'romana-tonda'),
  (select id from oven_profiles where slug = 'home-oven-steel' and owner_id is null),
  'en'::app_locale,
  null, 'piece'::unit_code,
  null, 'round'::pizza_shape,
  null, null,
  null, null, null,
  3, ARRAY['direct', 'thin']::text[]
)
on conflict (owner_id, slug) do update set
  type = excluded.type,
  status = excluded.status,
  authenticity = excluded.authenticity,
  style_id = excluded.style_id,
  oven_profile_id = excluded.oven_profile_id,
  origin_locale = excluded.origin_locale,
  base_yield = excluded.base_yield,
  yield_unit = excluded.yield_unit,
  base_diameter_mm = excluded.base_diameter_mm,
  base_shape = excluded.base_shape,
  base_tray_width_mm = excluded.base_tray_width_mm,
  base_tray_height_mm = excluded.base_tray_height_mm,
  base_ball_weight_g = excluded.base_ball_weight_g,
  active_minutes = excluded.active_minutes,
  passive_minutes = excluded.passive_minutes,
  difficulty = excluded.difficulty,
  tags = excluded.tags;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'ru', 'Идеальная римская тонкая пицца', 'Пицца тонда романа: низкая гидратация, раскатанная хрустящая основа.', null from recipes where slug = 'sisofo-roman-thin-crust' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'en', 'How to Make Perfect Roman Thin Crust Pizza', 'Pizza tonda romana: a low-hydration, rolled, crisp base.', null from recipes where slug = 'sisofo-roman-thin-crust' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'fr', 'La pizza romaine fine parfaite', 'Pizza tonda romana : faible hydratation, base croustillante étalée au rouleau.', null from recipes where slug = 'sisofo-roman-thin-crust' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
-- iacopelli-poolish-double-fermentation
insert into recipes (owner_id, slug, type, status, authenticity, style_id, oven_profile_id, origin_locale,
  base_yield, yield_unit, base_diameter_mm, base_shape, base_tray_width_mm, base_tray_height_mm,
  base_ball_weight_g, active_minutes, passive_minutes, difficulty, tags)
values (
  :owner_id, 'iacopelli-poolish-double-fermentation', 'dough'::recipe_type, 'needs_review'::recipe_status,
  'pizzaiolo'::authenticity_class,
  (select id from styles where slug = 'contemporanea'),
  (select id from oven_profiles where slug = 'home-oven-steel' and owner_id is null),
  'en'::app_locale,
  null, 'piece'::unit_code,
  null, null,
  null, null,
  null, 60, 1440,
  4, ARRAY['poolish', 'double-fermentation']::text[]
)
on conflict (owner_id, slug) do update set
  type = excluded.type,
  status = excluded.status,
  authenticity = excluded.authenticity,
  style_id = excluded.style_id,
  oven_profile_id = excluded.oven_profile_id,
  origin_locale = excluded.origin_locale,
  base_yield = excluded.base_yield,
  yield_unit = excluded.yield_unit,
  base_diameter_mm = excluded.base_diameter_mm,
  base_shape = excluded.base_shape,
  base_tray_width_mm = excluded.base_tray_width_mm,
  base_tray_height_mm = excluded.base_tray_height_mm,
  base_ball_weight_g = excluded.base_ball_weight_g,
  active_minutes = excluded.active_minutes,
  passive_minutes = excluded.passive_minutes,
  difficulty = excluded.difficulty,
  tags = excluded.tags;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'ru', 'Тесто нового уровня: двойная ферментация на пулише', 'Тесто на пулише с общей гидратацией около 70%. Ряд значений расходится между источниками.', null from recipes where slug = 'iacopelli-poolish-double-fermentation' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'en', 'Next Level Pizza Dough: Double Fermentation with Poolish', 'A poolish-based dough at roughly 70% total hydration. Several figures are disputed between sources.', null from recipes where slug = 'iacopelli-poolish-double-fermentation' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'fr', 'Pâte à pizza de niveau supérieur : double fermentation au poolish', 'Une pâte au poolish à environ 70 % d’hydratation. Plusieurs valeurs divergent selon les sources.', null from recipes where slug = 'iacopelli-poolish-double-fermentation' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
-- margherita-user
insert into recipes (owner_id, slug, type, status, authenticity, style_id, oven_profile_id, origin_locale,
  base_yield, yield_unit, base_diameter_mm, base_shape, base_tray_width_mm, base_tray_height_mm,
  base_ball_weight_g, active_minutes, passive_minutes, difficulty, tags)
values (
  :owner_id, 'margherita-user', 'pizza'::recipe_type, 'draft'::recipe_status,
  'user_verified'::authenticity_class,
  (select id from styles where slug = 'napoletana'),
  (select id from oven_profiles where slug = 'home-oven' and owner_id is null),
  'ru'::app_locale,
  1, 'piece'::unit_code,
  300, 'round'::pizza_shape,
  null, null,
  250, null, null,
  2, '{}'
)
on conflict (owner_id, slug) do update set
  type = excluded.type,
  status = excluded.status,
  authenticity = excluded.authenticity,
  style_id = excluded.style_id,
  oven_profile_id = excluded.oven_profile_id,
  origin_locale = excluded.origin_locale,
  base_yield = excluded.base_yield,
  yield_unit = excluded.yield_unit,
  base_diameter_mm = excluded.base_diameter_mm,
  base_shape = excluded.base_shape,
  base_tray_width_mm = excluded.base_tray_width_mm,
  base_tray_height_mm = excluded.base_tray_height_mm,
  base_ball_weight_g = excluded.base_ball_weight_g,
  active_minutes = excluded.active_minutes,
  passive_minutes = excluded.passive_minutes,
  difficulty = excluded.difficulty,
  tags = excluded.tags;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'ru', 'Маргарита', 'Томатный соус, моцарелла, пармезан, базилик и оливковое масло.', null from recipes where slug = 'margherita-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'en', 'Margherita', 'Tomato sauce, mozzarella, parmesan, basil and olive oil.', null from recipes where slug = 'margherita-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'fr', 'Margherita', 'Sauce tomate, mozzarella, parmesan, basilic et huile d’olive.', null from recipes where slug = 'margherita-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
-- pepperoni-user
insert into recipes (owner_id, slug, type, status, authenticity, style_id, oven_profile_id, origin_locale,
  base_yield, yield_unit, base_diameter_mm, base_shape, base_tray_width_mm, base_tray_height_mm,
  base_ball_weight_g, active_minutes, passive_minutes, difficulty, tags)
values (
  :owner_id, 'pepperoni-user', 'pizza'::recipe_type, 'draft'::recipe_status,
  'user_verified'::authenticity_class,
  (select id from styles where slug = 'napoletana'),
  (select id from oven_profiles where slug = 'home-oven' and owner_id is null),
  'ru'::app_locale,
  1, 'piece'::unit_code,
  300, 'round'::pizza_shape,
  null, null,
  250, null, null,
  2, '{}'
)
on conflict (owner_id, slug) do update set
  type = excluded.type,
  status = excluded.status,
  authenticity = excluded.authenticity,
  style_id = excluded.style_id,
  oven_profile_id = excluded.oven_profile_id,
  origin_locale = excluded.origin_locale,
  base_yield = excluded.base_yield,
  yield_unit = excluded.yield_unit,
  base_diameter_mm = excluded.base_diameter_mm,
  base_shape = excluded.base_shape,
  base_tray_width_mm = excluded.base_tray_width_mm,
  base_tray_height_mm = excluded.base_tray_height_mm,
  base_ball_weight_g = excluded.base_ball_weight_g,
  active_minutes = excluded.active_minutes,
  passive_minutes = excluded.passive_minutes,
  difficulty = excluded.difficulty,
  tags = excluded.tags;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'ru', 'Пепперони', 'Томатный соус, моцарелла, пепперони, базилик и оливковое масло.', null from recipes where slug = 'pepperoni-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'en', 'Pepperoni', 'Tomato sauce, mozzarella, pepperoni, basil and olive oil.', null from recipes where slug = 'pepperoni-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'fr', 'Pepperoni', 'Sauce tomate, mozzarella, pepperoni, basilic et huile d’olive.', null from recipes where slug = 'pepperoni-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
-- four-cheese-user
insert into recipes (owner_id, slug, type, status, authenticity, style_id, oven_profile_id, origin_locale,
  base_yield, yield_unit, base_diameter_mm, base_shape, base_tray_width_mm, base_tray_height_mm,
  base_ball_weight_g, active_minutes, passive_minutes, difficulty, tags)
values (
  :owner_id, 'four-cheese-user', 'pizza'::recipe_type, 'draft'::recipe_status,
  'user_verified'::authenticity_class,
  (select id from styles where slug = 'napoletana'),
  (select id from oven_profiles where slug = 'home-oven' and owner_id is null),
  'ru'::app_locale,
  1, 'piece'::unit_code,
  300, 'round'::pizza_shape,
  null, null,
  250, null, null,
  2, ARRAY['bianca']::text[]
)
on conflict (owner_id, slug) do update set
  type = excluded.type,
  status = excluded.status,
  authenticity = excluded.authenticity,
  style_id = excluded.style_id,
  oven_profile_id = excluded.oven_profile_id,
  origin_locale = excluded.origin_locale,
  base_yield = excluded.base_yield,
  yield_unit = excluded.yield_unit,
  base_diameter_mm = excluded.base_diameter_mm,
  base_shape = excluded.base_shape,
  base_tray_width_mm = excluded.base_tray_width_mm,
  base_tray_height_mm = excluded.base_tray_height_mm,
  base_ball_weight_g = excluded.base_ball_weight_g,
  active_minutes = excluded.active_minutes,
  passive_minutes = excluded.passive_minutes,
  difficulty = excluded.difficulty,
  tags = excluded.tags;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'ru', 'Четыре сыра', 'Моцарелла, фонталь, пекорино и горгонзола. Без томатного соуса.', null from recipes where slug = 'four-cheese-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'en', 'Four Cheese', 'Mozzarella, fontal, pecorino and gorgonzola. No tomato sauce.', null from recipes where slug = 'four-cheese-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'fr', 'Quatre fromages', 'Mozzarella, fontal, pecorino et gorgonzola. Sans sauce tomate.', null from recipes where slug = 'four-cheese-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
-- pesto-bufala-user
insert into recipes (owner_id, slug, type, status, authenticity, style_id, oven_profile_id, origin_locale,
  base_yield, yield_unit, base_diameter_mm, base_shape, base_tray_width_mm, base_tray_height_mm,
  base_ball_weight_g, active_minutes, passive_minutes, difficulty, tags)
values (
  :owner_id, 'pesto-bufala-user', 'pizza'::recipe_type, 'draft'::recipe_status,
  'user_verified'::authenticity_class,
  (select id from styles where slug = 'napoletana'),
  (select id from oven_profiles where slug = 'home-oven' and owner_id is null),
  'ru'::app_locale,
  1, 'piece'::unit_code,
  300, 'round'::pizza_shape,
  null, null,
  250, null, null,
  2, ARRAY['bianca']::text[]
)
on conflict (owner_id, slug) do update set
  type = excluded.type,
  status = excluded.status,
  authenticity = excluded.authenticity,
  style_id = excluded.style_id,
  oven_profile_id = excluded.oven_profile_id,
  origin_locale = excluded.origin_locale,
  base_yield = excluded.base_yield,
  yield_unit = excluded.yield_unit,
  base_diameter_mm = excluded.base_diameter_mm,
  base_shape = excluded.base_shape,
  base_tray_width_mm = excluded.base_tray_width_mm,
  base_tray_height_mm = excluded.base_tray_height_mm,
  base_ball_weight_g = excluded.base_ball_weight_g,
  active_minutes = excluded.active_minutes,
  passive_minutes = excluded.passive_minutes,
  difficulty = excluded.difficulty,
  tags = excluded.tags;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'ru', 'Песто и буфала', 'Песто дженовезе и моцарелла ди буфала.', null from recipes where slug = 'pesto-bufala-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'en', 'Pesto & Buffalo Mozzarella', 'Pesto genovese and mozzarella di bufala.', null from recipes where slug = 'pesto-bufala-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'fr', 'Pesto et mozzarella di bufala', 'Pesto genovese et mozzarella di bufala.', null from recipes where slug = 'pesto-bufala-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
-- mortadella-arugula-user
insert into recipes (owner_id, slug, type, status, authenticity, style_id, oven_profile_id, origin_locale,
  base_yield, yield_unit, base_diameter_mm, base_shape, base_tray_width_mm, base_tray_height_mm,
  base_ball_weight_g, active_minutes, passive_minutes, difficulty, tags)
values (
  :owner_id, 'mortadella-arugula-user', 'pizza'::recipe_type, 'draft'::recipe_status,
  'user_verified'::authenticity_class,
  (select id from styles where slug = 'napoletana'),
  (select id from oven_profiles where slug = 'home-oven' and owner_id is null),
  'ru'::app_locale,
  1, 'piece'::unit_code,
  300, 'round'::pizza_shape,
  null, null,
  250, null, null,
  2, '{}'
)
on conflict (owner_id, slug) do update set
  type = excluded.type,
  status = excluded.status,
  authenticity = excluded.authenticity,
  style_id = excluded.style_id,
  oven_profile_id = excluded.oven_profile_id,
  origin_locale = excluded.origin_locale,
  base_yield = excluded.base_yield,
  yield_unit = excluded.yield_unit,
  base_diameter_mm = excluded.base_diameter_mm,
  base_shape = excluded.base_shape,
  base_tray_width_mm = excluded.base_tray_width_mm,
  base_tray_height_mm = excluded.base_tray_height_mm,
  base_ball_weight_g = excluded.base_ball_weight_g,
  active_minutes = excluded.active_minutes,
  passive_minutes = excluded.passive_minutes,
  difficulty = excluded.difficulty,
  tags = excluded.tags;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'ru', 'Мортаделла и руккола', 'Томатный соус, моцарелла, пармезан, мортаделла и руккола.', null from recipes where slug = 'mortadella-arugula-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'en', 'Mortadella & Arugula', 'Tomato sauce, mozzarella, parmesan, mortadella and arugula.', null from recipes where slug = 'mortadella-arugula-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'fr', 'Mortadelle et roquette', 'Sauce tomate, mozzarella, parmesan, mortadelle et roquette.', null from recipes where slug = 'mortadella-arugula-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
-- arrabbiata-user
insert into recipes (owner_id, slug, type, status, authenticity, style_id, oven_profile_id, origin_locale,
  base_yield, yield_unit, base_diameter_mm, base_shape, base_tray_width_mm, base_tray_height_mm,
  base_ball_weight_g, active_minutes, passive_minutes, difficulty, tags)
values (
  :owner_id, 'arrabbiata-user', 'pizza'::recipe_type, 'needs_review'::recipe_status,
  'user_verified'::authenticity_class,
  (select id from styles where slug = 'napoletana'),
  (select id from oven_profiles where slug = 'home-oven' and owner_id is null),
  'ru'::app_locale,
  1, 'piece'::unit_code,
  300, 'round'::pizza_shape,
  null, null,
  250, null, null,
  2, '{}'
)
on conflict (owner_id, slug) do update set
  type = excluded.type,
  status = excluded.status,
  authenticity = excluded.authenticity,
  style_id = excluded.style_id,
  oven_profile_id = excluded.oven_profile_id,
  origin_locale = excluded.origin_locale,
  base_yield = excluded.base_yield,
  yield_unit = excluded.yield_unit,
  base_diameter_mm = excluded.base_diameter_mm,
  base_shape = excluded.base_shape,
  base_tray_width_mm = excluded.base_tray_width_mm,
  base_tray_height_mm = excluded.base_tray_height_mm,
  base_ball_weight_g = excluded.base_ball_weight_g,
  active_minutes = excluded.active_minutes,
  passive_minutes = excluded.passive_minutes,
  difficulty = excluded.difficulty,
  tags = excluded.tags;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'ru', 'Арраббьята', 'Острый соус аррабьята, пармезан и колбаска. Вид колбаски не определён.', null from recipes where slug = 'arrabbiata-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'en', 'Arrabbiata', 'Spicy arrabbiata sauce, parmesan and sausage. The kind of sausage is undetermined.', null from recipes where slug = 'arrabbiata-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'fr', 'Arrabbiata', 'Sauce arrabbiata piquante, parmesan et saucisse. Le type de saucisse est indéterminé.', null from recipes where slug = 'arrabbiata-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
-- pear-gorgonzola-user
insert into recipes (owner_id, slug, type, status, authenticity, style_id, oven_profile_id, origin_locale,
  base_yield, yield_unit, base_diameter_mm, base_shape, base_tray_width_mm, base_tray_height_mm,
  base_ball_weight_g, active_minutes, passive_minutes, difficulty, tags)
values (
  :owner_id, 'pear-gorgonzola-user', 'pizza'::recipe_type, 'needs_review'::recipe_status,
  'user_verified'::authenticity_class,
  (select id from styles where slug = 'napoletana'),
  (select id from oven_profiles where slug = 'home-oven' and owner_id is null),
  'ru'::app_locale,
  1, 'piece'::unit_code,
  300, 'round'::pizza_shape,
  null, null,
  250, null, null,
  2, ARRAY['bianca']::text[]
)
on conflict (owner_id, slug) do update set
  type = excluded.type,
  status = excluded.status,
  authenticity = excluded.authenticity,
  style_id = excluded.style_id,
  oven_profile_id = excluded.oven_profile_id,
  origin_locale = excluded.origin_locale,
  base_yield = excluded.base_yield,
  yield_unit = excluded.yield_unit,
  base_diameter_mm = excluded.base_diameter_mm,
  base_shape = excluded.base_shape,
  base_tray_width_mm = excluded.base_tray_width_mm,
  base_tray_height_mm = excluded.base_tray_height_mm,
  base_ball_weight_g = excluded.base_ball_weight_g,
  active_minutes = excluded.active_minutes,
  passive_minutes = excluded.passive_minutes,
  difficulty = excluded.difficulty,
  tags = excluded.tags;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'ru', 'Груша и горгонзола', 'Груша и горгонзола. Остальные ингредиенты не записаны.', null from recipes where slug = 'pear-gorgonzola-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'en', 'Pear & Gorgonzola', 'Pear and gorgonzola. The remaining ingredients were not written down.', null from recipes where slug = 'pear-gorgonzola-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;
insert into recipe_translations (recipe_id, locale, name, summary, notes) select id, 'fr', 'Poire et gorgonzola', 'Poire et gorgonzola. Les autres ingrédients ne sont pas notés.', null from recipes where slug = 'pear-gorgonzola-user' and owner_id = :owner_id
  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;

delete from recipe_items where recipe_id = (select id from recipes where slug = 'tomato-sauce-user' and owner_id = :owner_id);
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null),
  null,
  1, null, 'can'::unit_code,
  false, null, 0, 'tomatoes'
from recipes r where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'basil-fresh' and owner_id is null),
  null,
  null, null, 'to_taste'::unit_code,
  false, null, 1, 'basil'
from recipes r where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null),
  null,
  null, null, null,
  false, null, 2, 'oil'
from recipes r where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'salt-sea' and owner_id is null),
  null,
  null, null, 'to_taste'::unit_code,
  false, null, 3, 'salt'
from recipes r where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id;
delete from recipe_steps where recipe_id = (select id from recipes where slug = 'tomato-sauce-user' and owner_id = :owner_id);
insert into recipe_steps (recipe_id, step_key, sort_order, phase, active_minutes, wait_min_minutes, wait_max_minutes, duration_known, temperature_c, timer_seconds)
select r.id, 'crush', 0, 'prep'::step_phase, 5,
  0, 0,
  true, null, null
from recipes r where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'ru', 'Раздавить помидоры руками, сохраняя живую неоднородную текстуру.', 'Не измельчайте блендером — соус должен остаться неровным.', null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id and s.step_key = 'crush'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'en', 'Crush the tomatoes by hand, keeping a lively, uneven texture.', 'Do not blend — the sauce should stay rustic and uneven.', null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id and s.step_key = 'crush'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'fr', 'Écraser les tomates à la main en gardant une texture vivante et irrégulière.', 'Ne pas mixer — la sauce doit rester rustique.', null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id and s.step_key = 'crush'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_items (step_id, item_id)
select s.id, i.id
from recipe_steps s
join recipes r on r.id = s.recipe_id
join recipe_items i on i.recipe_id = r.id and i.item_key = 'tomatoes'
where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id and s.step_key = 'crush'
on conflict (step_id, item_id) do nothing;
insert into recipe_steps (recipe_id, step_key, sort_order, phase, active_minutes, wait_min_minutes, wait_max_minutes, duration_known, temperature_c, timer_seconds)
select r.id, 'basil-step', 1, 'prep'::step_phase, 2,
  0, 0,
  true, null, null
from recipes r where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'ru', 'Порвать листья базилика руками и добавить к помидорам.', null, null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id and s.step_key = 'basil-step'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'en', 'Tear the basil leaves by hand and add them to the tomatoes.', null, null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id and s.step_key = 'basil-step'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'fr', 'Déchirer les feuilles de basilic à la main et les ajouter aux tomates.', null, null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id and s.step_key = 'basil-step'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_items (step_id, item_id)
select s.id, i.id
from recipe_steps s
join recipes r on r.id = s.recipe_id
join recipe_items i on i.recipe_id = r.id and i.item_key = 'basil'
where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id and s.step_key = 'basil-step'
on conflict (step_id, item_id) do nothing;
insert into recipe_steps (recipe_id, step_key, sort_order, phase, active_minutes, wait_min_minutes, wait_max_minutes, duration_known, temperature_c, timer_seconds)
select r.id, 'salt-step', 2, 'prep'::step_phase, 1,
  0, 0,
  true, null, null
from recipes r where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'ru', 'Посолить по вкусу.', null, null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id and s.step_key = 'salt-step'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'en', 'Salt to taste.', null, null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id and s.step_key = 'salt-step'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'fr', 'Saler selon le goût.', null, null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id and s.step_key = 'salt-step'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_items (step_id, item_id)
select s.id, i.id
from recipe_steps s
join recipes r on r.id = s.recipe_id
join recipe_items i on i.recipe_id = r.id and i.item_key = 'salt'
where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id and s.step_key = 'salt-step'
on conflict (step_id, item_id) do nothing;
insert into recipe_steps (recipe_id, step_key, sort_order, phase, active_minutes, wait_min_minutes, wait_max_minutes, duration_known, temperature_c, timer_seconds)
select r.id, 'oil-step', 3, 'prep'::step_phase, 2,
  0, 0,
  true, null, null
from recipes r where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'ru', 'Добавить оливковое масло и перемешать.', null, null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id and s.step_key = 'oil-step'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'en', 'Add the olive oil and stir.', null, null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id and s.step_key = 'oil-step'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'fr', 'Ajouter l’huile d’olive et mélanger.', null, null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id and s.step_key = 'oil-step'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_items (step_id, item_id)
select s.id, i.id
from recipe_steps s
join recipes r on r.id = s.recipe_id
join recipe_items i on i.recipe_id = r.id and i.item_key = 'oil'
where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id and s.step_key = 'oil-step'
on conflict (step_id, item_id) do nothing;
delete from recipe_sources where recipe_id = (select id from recipes where slug = 'tomato-sauce-user' and owner_id = :owner_id);
insert into recipe_sources (recipe_id, source_type, author, title, url, attribution, credibility_tier)
select r.id, 'user'::source_type, null, null,
  null, null, 0.7
from recipes r where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id;
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe', (select id from recipes where slug = 'tomato-sauce-user' and owner_id = :owner_id), 'recipe.baseYield', 0,
    'needs_review'::review_state, null)
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Выход не задан: зависит от веса нетто выбранной банки.'),
  ('en'::app_locale, 'Yield is unset: it depends on the net weight of the chosen can.'),
  ('fr'::app_locale, 'Rendement non défini : il dépend du poids net de la boîte choisie.')
) as t(locale, note);
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe_item', (select i.id from recipe_items i join recipes r on r.id = i.recipe_id where r.slug = 'tomato-sauce-user' and r.owner_id = :owner_id and i.item_key = 'oil'), 'item.amount', 0,
    'needs_review'::review_state, null)
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Количество масла не указано владельцем.'),
  ('en'::app_locale, 'The owner did not state how much oil to use.'),
  ('fr'::app_locale, 'La quantité d’huile n’a pas été précisée.')
) as t(locale, note);

delete from recipe_items where recipe_id = (select id from recipes where slug = 'pesto-genovese-user' and owner_id = :owner_id);
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'basil-fresh' and owner_id is null),
  null,
  50, null, 'g'::unit_code,
  false, null, 0, 'basil'
from recipes r where r.slug = 'pesto-genovese-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'pine-nuts' and owner_id is null),
  null,
  30, null, 'g'::unit_code,
  false, null, 1, 'pine-nuts'
from recipes r where r.slug = 'pesto-genovese-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'garlic' and owner_id is null),
  null,
  1, 2, 'clove'::unit_code,
  false, null, 2, 'garlic'
from recipes r where r.slug = 'pesto-genovese-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'parmigiano-reggiano' and owner_id is null),
  null,
  70, null, 'g'::unit_code,
  false, null, 3, 'parmesan'
from recipes r where r.slug = 'pesto-genovese-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'pecorino-sardo' and owner_id is null),
  null,
  30, null, 'g'::unit_code,
  false, null, 4, 'pecorino'
from recipes r where r.slug = 'pesto-genovese-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null),
  null,
  75, null, 'ml'::unit_code,
  false, null, 5, 'oil'
from recipes r where r.slug = 'pesto-genovese-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'salt-sea' and owner_id is null),
  null,
  null, null, 'pinch'::unit_code,
  false, null, 6, 'salt'
from recipes r where r.slug = 'pesto-genovese-user' and r.owner_id = :owner_id;
delete from recipe_steps where recipe_id = (select id from recipes where slug = 'pesto-genovese-user' and owner_id = :owner_id);
delete from recipe_sources where recipe_id = (select id from recipes where slug = 'pesto-genovese-user' and owner_id = :owner_id);
insert into recipe_sources (recipe_id, source_type, author, title, url, attribution, credibility_tier)
select r.id, 'user'::source_type, null, null,
  null, null, 0.7
from recipes r where r.slug = 'pesto-genovese-user' and r.owner_id = :owner_id;
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe', (select id from recipes where slug = 'pesto-genovese-user' and owner_id = :owner_id), 'recipe.baseYield', 0.2,
    'conflict'::review_state, 'pesto-yield')
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Заявленный выход 150–170 г, но сумма ингредиентов превышает 250 г ещё до потерь. Заявленная порция на пиццу — 30 г и 5–6 пицц. Требуется подтверждение владельца.'),
  ('en'::app_locale, 'Stated yield is 150-170 g, yet the ingredients total over 250 g before any process loss. The stated pizza portion is 30 g across 5-6 pizzas. Needs the owner to confirm.'),
  ('fr'::app_locale, 'Rendement annoncé de 150 à 170 g, alors que les ingrédients dépassent 250 g avant pertes. La portion annoncée est de 30 g pour 5 à 6 pizzas. À confirmer.')
) as t(locale, note);
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe', (select id from recipes where slug = 'pesto-genovese-user' and owner_id = :owner_id), 'recipe.steps', 0,
    'needs_review'::review_state, null)
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Способ приготовления не записан.'),
  ('en'::app_locale, 'The method was never written down.'),
  ('fr'::app_locale, 'La méthode n’a pas été notée.')
) as t(locale, note);

delete from recipe_items where recipe_id = (select id from recipes where slug = 'arrabbiata-sauce-user' and owner_id = :owner_id);
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'tomatoes-whole-peeled-canned' and owner_id is null),
  null,
  null, null, null,
  false, null, 0, 'tomatoes'
from recipes r where r.slug = 'arrabbiata-sauce-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'garlic' and owner_id is null),
  null,
  null, null, null,
  false, null, 1, 'garlic'
from recipes r where r.slug = 'arrabbiata-sauce-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'chili-flakes' and owner_id is null),
  null,
  null, null, null,
  false, null, 2, 'chili'
from recipes r where r.slug = 'arrabbiata-sauce-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null),
  null,
  null, null, null,
  false, null, 3, 'oil'
from recipes r where r.slug = 'arrabbiata-sauce-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'salt-sea' and owner_id is null),
  null,
  null, null, 'to_taste'::unit_code,
  false, null, 4, 'salt'
from recipes r where r.slug = 'arrabbiata-sauce-user' and r.owner_id = :owner_id;
delete from recipe_steps where recipe_id = (select id from recipes where slug = 'arrabbiata-sauce-user' and owner_id = :owner_id);
delete from recipe_sources where recipe_id = (select id from recipes where slug = 'arrabbiata-sauce-user' and owner_id = :owner_id);
insert into recipe_sources (recipe_id, source_type, author, title, url, attribution, credibility_tier)
select r.id, 'user'::source_type, null, null,
  null, null, 0.7
from recipes r where r.slug = 'arrabbiata-sauce-user' and r.owner_id = :owner_id;
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe', (select id from recipes where slug = 'arrabbiata-sauce-user' and owner_id = :owner_id), 'recipe.items', 0,
    'needs_review'::review_state, null)
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Ни одно количество не задано.'),
  ('en'::app_locale, 'No quantities have been recorded.'),
  ('fr'::app_locale, 'Aucune quantité n’a été enregistrée.')
) as t(locale, note);

delete from recipe_items where recipe_id = (select id from recipes where slug = 'sisofo-forgotten-neapolitan' and owner_id = :owner_id);
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'flour-type-00' and owner_id is null),
  null,
  520, null, 'g'::unit_code,
  false, null, 0, 'flour'
from recipes r where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'water' and owner_id is null),
  null,
  310, null, 'g'::unit_code,
  false, null, 1, 'water'
from recipes r where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'salt-sea' and owner_id is null),
  null,
  13, null, 'g'::unit_code,
  false, null, 2, 'salt'
from recipes r where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'yeast-active-dry' and owner_id is null),
  null,
  0.156, null, 'g'::unit_code,
  false, null, 3, 'yeast'
from recipes r where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id;
delete from recipe_steps where recipe_id = (select id from recipes where slug = 'sisofo-forgotten-neapolitan' and owner_id = :owner_id);
insert into recipe_steps (recipe_id, step_key, sort_order, phase, active_minutes, wait_min_minutes, wait_max_minutes, duration_known, temperature_c, timer_seconds)
select r.id, 'mix', 0, 'mix'::step_phase, 20,
  0, 0,
  true, null, null
from recipes r where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'ru', 'Смешать муку, воду, соль и дрожжи до гладкого теста.', null, null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id and s.step_key = 'mix'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'en', 'Mix flour, water, salt and yeast to a smooth dough.', null, null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id and s.step_key = 'mix'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'fr', 'Mélanger farine, eau, sel et levure jusqu’à obtenir une pâte lisse.', null, null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id and s.step_key = 'mix'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_items (step_id, item_id)
select s.id, i.id
from recipe_steps s
join recipes r on r.id = s.recipe_id
join recipe_items i on i.recipe_id = r.id and i.item_key = 'flour'
where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id and s.step_key = 'mix'
on conflict (step_id, item_id) do nothing;
insert into recipe_step_items (step_id, item_id)
select s.id, i.id
from recipe_steps s
join recipes r on r.id = s.recipe_id
join recipe_items i on i.recipe_id = r.id and i.item_key = 'water'
where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id and s.step_key = 'mix'
on conflict (step_id, item_id) do nothing;
insert into recipe_step_items (step_id, item_id)
select s.id, i.id
from recipe_steps s
join recipes r on r.id = s.recipe_id
join recipe_items i on i.recipe_id = r.id and i.item_key = 'salt'
where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id and s.step_key = 'mix'
on conflict (step_id, item_id) do nothing;
insert into recipe_step_items (step_id, item_id)
select s.id, i.id
from recipe_steps s
join recipes r on r.id = s.recipe_id
join recipe_items i on i.recipe_id = r.id and i.item_key = 'yeast'
where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id and s.step_key = 'mix'
on conflict (step_id, item_id) do nothing;
insert into recipe_steps (recipe_id, step_key, sort_order, phase, active_minutes, wait_min_minutes, wait_max_minutes, duration_known, temperature_c, timer_seconds)
select r.id, 'bulk', 1, 'bulk'::step_phase, 0,
  1200, 1560,
  true, null, null
from recipes r where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'ru', 'Ферментировать при комнатной температуре около 24 часов.', 'Тесто должно заметно подняться и стать воздушным.', null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id and s.step_key = 'bulk'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'en', 'Ferment at room temperature for about 24 hours.', 'The dough should be visibly risen and airy, not merely older.', null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id and s.step_key = 'bulk'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'fr', 'Laisser fermenter à température ambiante environ 24 heures.', 'La pâte doit être visiblement levée et aérée.', null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id and s.step_key = 'bulk'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_steps (recipe_id, step_key, sort_order, phase, active_minutes, wait_min_minutes, wait_max_minutes, duration_known, temperature_c, timer_seconds)
select r.id, 'ball', 2, 'ball'::step_phase, 15,
  0, 0,
  true, null, null
from recipes r where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'ru', 'Разделить и сформовать 3 шара.', null, null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id and s.step_key = 'ball'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'en', 'Divide and shape into 3 balls.', null, null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id and s.step_key = 'ball'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'fr', 'Diviser et former 3 pâtons.', null, null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id and s.step_key = 'ball'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
delete from recipe_sources where recipe_id = (select id from recipes where slug = 'sisofo-forgotten-neapolitan' and owner_id = :owner_id);
insert into recipe_sources (recipe_id, source_type, author, title, url, attribution, credibility_tier)
select r.id, 'youtube'::source_type, 'Julian Sisofo', 'The Forgotten Style of Neapolitan Pizza',
  'https://www.youtube.com/watch?v=o35mHoq5v0s', 'Formula as stated by Julian Sisofo.', 0.9
from recipes r where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id;
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe', (select id from recipes where slug = 'sisofo-forgotten-neapolitan' and owner_id = :owner_id), 'recipe.method', 0.5,
    'needs_review'::review_state, null)
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Метод замеса и точные тайминги требуют проверки по видео.'),
  ('en'::app_locale, 'Mixing method and exact timings still need to be verified against the video before this can be marked verified.'),
  ('fr'::app_locale, 'La méthode de pétrissage et les durées exactes restent à vérifier.')
) as t(locale, note);
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe_item', (select i.id from recipe_items i join recipes r on r.id = i.recipe_id where r.slug = 'sisofo-forgotten-neapolitan' and r.owner_id = :owner_id and i.item_key = 'yeast'), 'item.amount', 0.8,
    'needs_review'::review_state, null)
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Указано 0,03% от муки, то есть примерно 0,16 г.'),
  ('en'::app_locale, 'Stated as 0.03% of flour, which works out to about 0.16 g.'),
  ('fr'::app_locale, 'Indiqué à 0,03 % de la farine, soit environ 0,16 g.')
) as t(locale, note);

delete from recipe_items where recipe_id = (select id from recipes where slug = 'sisofo-crispiest-teglia' and owner_id = :owner_id);
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'flour-pinsa' and owner_id is null),
  null,
  400, null, 'g'::unit_code,
  false, 'biga', 0, 'biga-flour'
from recipes r where r.slug = 'sisofo-crispiest-teglia' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'water' and owner_id is null),
  null,
  200, null, 'g'::unit_code,
  false, 'biga', 1, 'biga-water'
from recipes r where r.slug = 'sisofo-crispiest-teglia' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'yeast-active-dry' and owner_id is null),
  null,
  2, null, 'g'::unit_code,
  false, 'biga', 2, 'biga-yeast'
from recipes r where r.slug = 'sisofo-crispiest-teglia' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'water' and owner_id is null),
  null,
  null, null, null,
  false, 'final', 3, 'final-water'
from recipes r where r.slug = 'sisofo-crispiest-teglia' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'salt-sea' and owner_id is null),
  null,
  null, null, null,
  false, 'final', 4, 'final-salt'
from recipes r where r.slug = 'sisofo-crispiest-teglia' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null),
  null,
  null, null, null,
  false, 'final', 5, 'final-oil'
from recipes r where r.slug = 'sisofo-crispiest-teglia' and r.owner_id = :owner_id;
delete from recipe_steps where recipe_id = (select id from recipes where slug = 'sisofo-crispiest-teglia' and owner_id = :owner_id);
insert into recipe_steps (recipe_id, step_key, sort_order, phase, active_minutes, wait_min_minutes, wait_max_minutes, duration_known, temperature_c, timer_seconds)
select r.id, 'biga', 0, 'preferment'::step_phase, 15,
  0, 0,
  false, null, null
from recipes r where r.slug = 'sisofo-crispiest-teglia' and r.owner_id = :owner_id;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'ru', 'Завести бигу: 2 г сухих дрожжей, 400 г муки для пинсы и 200 г воды.', 'Время ферментации биги из источника не зафиксировано.', null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'sisofo-crispiest-teglia' and r.owner_id = :owner_id and s.step_key = 'biga'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'en', 'Start the biga with 2 g active dry yeast, 400 g pinsa flour and 200 g water.', 'Fermentation time for the biga was not captured from the source.', null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'sisofo-crispiest-teglia' and r.owner_id = :owner_id and s.step_key = 'biga'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'fr', 'Préparer la biga : 2 g de levure sèche, 400 g de farine à pinsa et 200 g d’eau.', 'Le temps de fermentation de la biga n’a pas été relevé.', null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'sisofo-crispiest-teglia' and r.owner_id = :owner_id and s.step_key = 'biga'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_items (step_id, item_id)
select s.id, i.id
from recipe_steps s
join recipes r on r.id = s.recipe_id
join recipe_items i on i.recipe_id = r.id and i.item_key = 'biga-flour'
where r.slug = 'sisofo-crispiest-teglia' and r.owner_id = :owner_id and s.step_key = 'biga'
on conflict (step_id, item_id) do nothing;
insert into recipe_step_items (step_id, item_id)
select s.id, i.id
from recipe_steps s
join recipes r on r.id = s.recipe_id
join recipe_items i on i.recipe_id = r.id and i.item_key = 'biga-water'
where r.slug = 'sisofo-crispiest-teglia' and r.owner_id = :owner_id and s.step_key = 'biga'
on conflict (step_id, item_id) do nothing;
insert into recipe_step_items (step_id, item_id)
select s.id, i.id
from recipe_steps s
join recipes r on r.id = s.recipe_id
join recipe_items i on i.recipe_id = r.id and i.item_key = 'biga-yeast'
where r.slug = 'sisofo-crispiest-teglia' and r.owner_id = :owner_id and s.step_key = 'biga'
on conflict (step_id, item_id) do nothing;
delete from recipe_sources where recipe_id = (select id from recipes where slug = 'sisofo-crispiest-teglia' and owner_id = :owner_id);
insert into recipe_sources (recipe_id, source_type, author, title, url, attribution, credibility_tier)
select r.id, 'youtube'::source_type, 'Julian Sisofo', 'The Crispiest Pizza You''ve Never Made',
  'https://www.youtube.com/watch?v=Wc1i3-afCTc', 'Biga quantities as stated by Julian Sisofo.', 0.9
from recipes r where r.slug = 'sisofo-crispiest-teglia' and r.owner_id = :owner_id;
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe', (select id from recipes where slug = 'sisofo-crispiest-teglia' and owner_id = :owner_id), 'recipe.items', 0.3,
    'needs_review'::review_state, null)
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Задокументирована только бига. Количества финального теста и тайминги требуют проверки.'),
  ('en'::app_locale, 'Only the biga is documented. Final-dough quantities and all timings need transcript or source verification.'),
  ('fr'::app_locale, 'Seule la biga est documentée. Les quantités finales et les durées restent à vérifier.')
) as t(locale, note);

delete from recipe_items where recipe_id = (select id from recipes where slug = 'sisofo-roman-thin-crust' and owner_id = :owner_id);
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'flour-type-0' and owner_id is null),
  null,
  380, null, 'g'::unit_code,
  false, null, 0, 'flour'
from recipes r where r.slug = 'sisofo-roman-thin-crust' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'water' and owner_id is null),
  null,
  210, null, 'g'::unit_code,
  false, null, 1, 'water'
from recipes r where r.slug = 'sisofo-roman-thin-crust' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'salt-sea' and owner_id is null),
  null,
  8, null, 'g'::unit_code,
  false, null, 2, 'salt'
from recipes r where r.slug = 'sisofo-roman-thin-crust' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'yeast-active-dry' and owner_id is null),
  null,
  0.5, null, 'g'::unit_code,
  false, null, 3, 'yeast'
from recipes r where r.slug = 'sisofo-roman-thin-crust' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null),
  null,
  15, null, 'g'::unit_code,
  false, null, 4, 'oil'
from recipes r where r.slug = 'sisofo-roman-thin-crust' and r.owner_id = :owner_id;
delete from recipe_steps where recipe_id = (select id from recipes where slug = 'sisofo-roman-thin-crust' and owner_id = :owner_id);
delete from recipe_sources where recipe_id = (select id from recipes where slug = 'sisofo-roman-thin-crust' and owner_id = :owner_id);
insert into recipe_sources (recipe_id, source_type, author, title, url, attribution, credibility_tier)
select r.id, 'youtube'::source_type, 'Julian Sisofo', 'How to Make Perfect Roman Thin Crust Pizza',
  'https://www.youtube.com/watch?v=ubT1JUypPwE', 'Formula as stated by Julian Sisofo.', 0.9
from recipes r where r.slug = 'sisofo-roman-thin-crust' and r.owner_id = :owner_id;
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe', (select id from recipes where slug = 'sisofo-roman-thin-crust' and owner_id = :owner_id), 'recipe.baseYield', 0,
    'needs_review'::review_state, null)
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Количество пицц не указано. Гидратация составляет около 55,26%.'),
  ('en'::app_locale, 'The number of pizzas this formula makes was not stated. Hydration works out to about 55.26%.'),
  ('fr'::app_locale, 'Le nombre de pizzas n’est pas indiqué. L’hydratation est d’environ 55,26 %.')
) as t(locale, note);
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe', (select id from recipes where slug = 'sisofo-roman-thin-crust' and owner_id = :owner_id), 'recipe.method', 0,
    'needs_review'::review_state, null)
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Полный метод требует расшифровки из источника.'),
  ('en'::app_locale, 'The full method still needs to be transcribed from the source.'),
  ('fr'::app_locale, 'La méthode complète reste à transcrire.')
) as t(locale, note);

delete from recipe_items where recipe_id = (select id from recipes where slug = 'iacopelli-poolish-double-fermentation' and owner_id = :owner_id);
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'water' and owner_id is null),
  null,
  300, null, 'g'::unit_code,
  false, 'poolish', 0, 'poolish-water'
from recipes r where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'flour-type-00' and owner_id is null),
  null,
  300, null, 'g'::unit_code,
  false, 'poolish', 1, 'poolish-flour'
from recipes r where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'honey' and owner_id is null),
  null,
  5, null, 'g'::unit_code,
  false, 'poolish', 2, 'poolish-honey'
from recipes r where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'yeast-active-dry' and owner_id is null),
  null,
  5, 6, 'g'::unit_code,
  false, 'poolish', 3, 'poolish-yeast'
from recipes r where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'water' and owner_id is null),
  null,
  400, null, 'g'::unit_code,
  false, 'final', 4, 'final-water'
from recipes r where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'flour-type-00' and owner_id is null),
  null,
  700, null, 'g'::unit_code,
  false, 'final', 5, 'final-flour'
from recipes r where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'salt-sea' and owner_id is null),
  null,
  25, 30, 'g'::unit_code,
  false, 'final', 6, 'final-salt'
from recipes r where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null),
  null,
  10, null, 'g'::unit_code,
  false, 'final', 7, 'final-oil'
from recipes r where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id;
delete from recipe_steps where recipe_id = (select id from recipes where slug = 'iacopelli-poolish-double-fermentation' and owner_id = :owner_id);
insert into recipe_steps (recipe_id, step_key, sort_order, phase, active_minutes, wait_min_minutes, wait_max_minutes, duration_known, temperature_c, timer_seconds)
select r.id, 'poolish', 0, 'preferment'::step_phase, 10,
  60, 1080,
  false, null, null
from recipes r where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'ru', 'Приготовить пулиш из воды, муки, мёда и дрожжей и дать ему выбродить.', 'Готов, когда куполом и в пузырях; точное время не зафиксировано.', null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id and s.step_key = 'poolish'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'en', 'Make the poolish from water, flour, honey and yeast, then let it ferment.', 'Ready when domed and bubbling; the exact time was not captured.', null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id and s.step_key = 'poolish'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, 'fr', 'Préparer le poolish avec eau, farine, miel et levure, puis laisser fermenter.', 'Prêt lorsqu’il est bombé et bullé ; la durée exacte n’a pas été relevée.', null
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id and s.step_key = 'poolish'
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;
insert into recipe_step_items (step_id, item_id)
select s.id, i.id
from recipe_steps s
join recipes r on r.id = s.recipe_id
join recipe_items i on i.recipe_id = r.id and i.item_key = 'poolish-water'
where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id and s.step_key = 'poolish'
on conflict (step_id, item_id) do nothing;
insert into recipe_step_items (step_id, item_id)
select s.id, i.id
from recipe_steps s
join recipes r on r.id = s.recipe_id
join recipe_items i on i.recipe_id = r.id and i.item_key = 'poolish-flour'
where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id and s.step_key = 'poolish'
on conflict (step_id, item_id) do nothing;
insert into recipe_step_items (step_id, item_id)
select s.id, i.id
from recipe_steps s
join recipes r on r.id = s.recipe_id
join recipe_items i on i.recipe_id = r.id and i.item_key = 'poolish-honey'
where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id and s.step_key = 'poolish'
on conflict (step_id, item_id) do nothing;
insert into recipe_step_items (step_id, item_id)
select s.id, i.id
from recipe_steps s
join recipes r on r.id = s.recipe_id
join recipe_items i on i.recipe_id = r.id and i.item_key = 'poolish-yeast'
where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id and s.step_key = 'poolish'
on conflict (step_id, item_id) do nothing;
delete from recipe_sources where recipe_id = (select id from recipes where slug = 'iacopelli-poolish-double-fermentation' and owner_id = :owner_id);
insert into recipe_sources (recipe_id, source_type, author, title, url, attribution, credibility_tier)
select r.id, 'youtube'::source_type, 'Vito Iacopelli', 'Next Level Pizza Dough / Double Fermentation with Poolish',
  'https://www.youtube.com/watch?v=u7Hd6ZzKgBM', 'Candidate formula attributed to Vito Iacopelli; several fields disputed.', 0.85
from recipes r where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id;
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe_item', (select i.id from recipe_items i join recipes r on r.id = i.recipe_id where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id and i.item_key = 'poolish-yeast'), 'item.amount', 0.4,
    'conflict'::review_state, 'iacopelli-yeast')
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Сторонние расшифровки расходятся по весу дрожжей (5 г против 6 г). Записано диапазоном до подтверждения.'),
  ('en'::app_locale, 'Third-party parses disagree on the yeast weight (5 g vs 6 g). Recorded as a range until the primary video or description confirms one value.'),
  ('fr'::app_locale, 'Les transcriptions tierces divergent sur la levure (5 g contre 6 g). Enregistré comme une plage.')
) as t(locale, note);
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe_item', (select i.id from recipe_items i join recipes r on r.id = i.recipe_id where r.slug = 'iacopelli-poolish-double-fermentation' and r.owner_id = :owner_id and i.item_key = 'final-salt'), 'item.amount', 0.4,
    'conflict'::review_state, 'iacopelli-salt')
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Соль указывается то как 25 г, то как 30 г — 2,5% против 3% от муки. Значение не выбирается автоматически.'),
  ('en'::app_locale, 'Salt is reported as 25 g by some sources and 30 g by others, i.e. 2.5% vs 3% of flour. No value is chosen automatically.'),
  ('fr'::app_locale, 'Le sel est indiqué à 25 g ou 30 g selon les sources, soit 2,5 % contre 3 %. Aucune valeur n’est choisie automatiquement.')
) as t(locale, note);
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe', (select id from recipes where slug = 'iacopelli-poolish-double-fermentation' and owner_id = :owner_id), 'recipe.baseYield', 0.2,
    'conflict'::review_state, 'iacopelli-yield')
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Количество и вес шаров теста спорны. Общая гидратация — около 70%.'),
  ('en'::app_locale, 'The number and weight of dough balls is disputed. Total hydration works out to about 70%.'),
  ('fr'::app_locale, 'Le nombre et le poids des pâtons sont contestés. L’hydratation totale est d’environ 70 %.')
) as t(locale, note);

delete from recipe_items where recipe_id = (select id from recipes where slug = 'margherita-user' and owner_id = :owner_id);
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  null,
  (select id from recipes where slug = 'tomato-sauce-user' and owner_id = :owner_id),
  null, null, null,
  false, null, 0, 'sauce'
from recipes r where r.slug = 'margherita-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null),
  null,
  null, null, null,
  false, null, 1, 'oil'
from recipes r where r.slug = 'margherita-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'basil-fresh' and owner_id is null),
  null,
  null, null, null,
  false, null, 2, 'basil'
from recipes r where r.slug = 'margherita-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null),
  null,
  null, null, null,
  false, null, 3, 'mozzarella'
from recipes r where r.slug = 'margherita-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'parmigiano-reggiano' and owner_id is null),
  null,
  null, null, null,
  false, null, 4, 'parmesan'
from recipes r where r.slug = 'margherita-user' and r.owner_id = :owner_id;
delete from recipe_steps where recipe_id = (select id from recipes where slug = 'margherita-user' and owner_id = :owner_id);
delete from recipe_sources where recipe_id = (select id from recipes where slug = 'margherita-user' and owner_id = :owner_id);
insert into recipe_sources (recipe_id, source_type, author, title, url, attribution, credibility_tier)
select r.id, 'user'::source_type, null, null,
  null, null, 0.7
from recipes r where r.slug = 'margherita-user' and r.owner_id = :owner_id;
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe', (select id from recipes where slug = 'margherita-user' and owner_id = :owner_id), 'recipe.items', 0,
    'needs_review'::review_state, null)
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Количества не заданы владельцем — заполните их, чтобы включить пересчёт и список покупок.'),
  ('en'::app_locale, 'The owner did not state amounts — fill them in to enable scaling and the shopping list.'),
  ('fr'::app_locale, 'Les quantités ne sont pas renseignées — complétez-les pour activer le calcul et la liste de courses.')
) as t(locale, note);

delete from recipe_items where recipe_id = (select id from recipes where slug = 'pepperoni-user' and owner_id = :owner_id);
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  null,
  (select id from recipes where slug = 'tomato-sauce-user' and owner_id = :owner_id),
  null, null, null,
  false, null, 0, 'sauce'
from recipes r where r.slug = 'pepperoni-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null),
  null,
  null, null, null,
  false, null, 1, 'oil'
from recipes r where r.slug = 'pepperoni-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'basil-fresh' and owner_id is null),
  null,
  null, null, null,
  false, null, 2, 'basil'
from recipes r where r.slug = 'pepperoni-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null),
  null,
  null, null, null,
  false, null, 3, 'mozzarella'
from recipes r where r.slug = 'pepperoni-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'pepperoni' and owner_id is null),
  null,
  null, null, null,
  false, null, 4, 'pepperoni'
from recipes r where r.slug = 'pepperoni-user' and r.owner_id = :owner_id;
delete from recipe_steps where recipe_id = (select id from recipes where slug = 'pepperoni-user' and owner_id = :owner_id);
delete from recipe_sources where recipe_id = (select id from recipes where slug = 'pepperoni-user' and owner_id = :owner_id);
insert into recipe_sources (recipe_id, source_type, author, title, url, attribution, credibility_tier)
select r.id, 'user'::source_type, null, null,
  null, null, 0.7
from recipes r where r.slug = 'pepperoni-user' and r.owner_id = :owner_id;
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe', (select id from recipes where slug = 'pepperoni-user' and owner_id = :owner_id), 'recipe.items', 0,
    'needs_review'::review_state, null)
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Количества не заданы владельцем — заполните их, чтобы включить пересчёт и список покупок.'),
  ('en'::app_locale, 'The owner did not state amounts — fill them in to enable scaling and the shopping list.'),
  ('fr'::app_locale, 'Les quantités ne sont pas renseignées — complétez-les pour activer le calcul et la liste de courses.')
) as t(locale, note);

delete from recipe_items where recipe_id = (select id from recipes where slug = 'four-cheese-user' and owner_id = :owner_id);
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null),
  null,
  null, null, null,
  false, null, 0, 'mozzarella'
from recipes r where r.slug = 'four-cheese-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'fontal' and owner_id is null),
  null,
  null, null, null,
  false, null, 1, 'fontal'
from recipes r where r.slug = 'four-cheese-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'pecorino' and owner_id is null),
  null,
  null, null, null,
  false, null, 2, 'pecorino'
from recipes r where r.slug = 'four-cheese-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'gorgonzola' and owner_id is null),
  null,
  null, null, null,
  false, null, 3, 'gorgonzola'
from recipes r where r.slug = 'four-cheese-user' and r.owner_id = :owner_id;
delete from recipe_steps where recipe_id = (select id from recipes where slug = 'four-cheese-user' and owner_id = :owner_id);
delete from recipe_sources where recipe_id = (select id from recipes where slug = 'four-cheese-user' and owner_id = :owner_id);
insert into recipe_sources (recipe_id, source_type, author, title, url, attribution, credibility_tier)
select r.id, 'user'::source_type, null, null,
  null, null, 0.7
from recipes r where r.slug = 'four-cheese-user' and r.owner_id = :owner_id;
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe', (select id from recipes where slug = 'four-cheese-user' and owner_id = :owner_id), 'recipe.items', 0,
    'needs_review'::review_state, null)
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Количества не заданы владельцем — заполните их, чтобы включить пересчёт и список покупок.'),
  ('en'::app_locale, 'The owner did not state amounts — fill them in to enable scaling and the shopping list.'),
  ('fr'::app_locale, 'Les quantités ne sont pas renseignées — complétez-les pour activer le calcul et la liste de courses.')
) as t(locale, note);

delete from recipe_items where recipe_id = (select id from recipes where slug = 'pesto-bufala-user' and owner_id = :owner_id);
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  null,
  (select id from recipes where slug = 'pesto-genovese-user' and owner_id = :owner_id),
  null, null, null,
  false, null, 0, 'pesto'
from recipes r where r.slug = 'pesto-bufala-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'mozzarella-di-bufala' and owner_id is null),
  null,
  null, null, null,
  false, null, 1, 'bufala'
from recipes r where r.slug = 'pesto-bufala-user' and r.owner_id = :owner_id;
delete from recipe_steps where recipe_id = (select id from recipes where slug = 'pesto-bufala-user' and owner_id = :owner_id);
delete from recipe_sources where recipe_id = (select id from recipes where slug = 'pesto-bufala-user' and owner_id = :owner_id);
insert into recipe_sources (recipe_id, source_type, author, title, url, attribution, credibility_tier)
select r.id, 'user'::source_type, null, null,
  null, null, 0.7
from recipes r where r.slug = 'pesto-bufala-user' and r.owner_id = :owner_id;
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe', (select id from recipes where slug = 'pesto-bufala-user' and owner_id = :owner_id), 'recipe.items', 0,
    'needs_review'::review_state, null)
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Количества не заданы владельцем — заполните их, чтобы включить пересчёт и список покупок.'),
  ('en'::app_locale, 'The owner did not state amounts — fill them in to enable scaling and the shopping list.'),
  ('fr'::app_locale, 'Les quantités ne sont pas renseignées — complétez-les pour activer le calcul et la liste de courses.')
) as t(locale, note);

delete from recipe_items where recipe_id = (select id from recipes where slug = 'mortadella-arugula-user' and owner_id = :owner_id);
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  null,
  (select id from recipes where slug = 'tomato-sauce-user' and owner_id = :owner_id),
  null, null, null,
  false, null, 0, 'sauce'
from recipes r where r.slug = 'mortadella-arugula-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'mozzarella-fior-di-latte' and owner_id is null),
  null,
  null, null, null,
  false, null, 1, 'mozzarella'
from recipes r where r.slug = 'mortadella-arugula-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'parmigiano-reggiano' and owner_id is null),
  null,
  null, null, null,
  false, null, 2, 'parmesan'
from recipes r where r.slug = 'mortadella-arugula-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'olive-oil-extra-virgin' and owner_id is null),
  null,
  null, null, null,
  false, null, 3, 'oil'
from recipes r where r.slug = 'mortadella-arugula-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'mortadella' and owner_id is null),
  null,
  null, null, null,
  false, null, 4, 'mortadella'
from recipes r where r.slug = 'mortadella-arugula-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'arugula' and owner_id is null),
  null,
  null, null, null,
  false, null, 5, 'arugula'
from recipes r where r.slug = 'mortadella-arugula-user' and r.owner_id = :owner_id;
delete from recipe_steps where recipe_id = (select id from recipes where slug = 'mortadella-arugula-user' and owner_id = :owner_id);
delete from recipe_sources where recipe_id = (select id from recipes where slug = 'mortadella-arugula-user' and owner_id = :owner_id);
insert into recipe_sources (recipe_id, source_type, author, title, url, attribution, credibility_tier)
select r.id, 'user'::source_type, null, null,
  null, null, 0.7
from recipes r where r.slug = 'mortadella-arugula-user' and r.owner_id = :owner_id;
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe', (select id from recipes where slug = 'mortadella-arugula-user' and owner_id = :owner_id), 'recipe.items', 0,
    'needs_review'::review_state, null)
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Количества не заданы владельцем — заполните их, чтобы включить пересчёт и список покупок.'),
  ('en'::app_locale, 'The owner did not state amounts — fill them in to enable scaling and the shopping list.'),
  ('fr'::app_locale, 'Les quantités ne sont pas renseignées — complétez-les pour activer le calcul et la liste de courses.')
) as t(locale, note);

delete from recipe_items where recipe_id = (select id from recipes where slug = 'arrabbiata-user' and owner_id = :owner_id);
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  null,
  (select id from recipes where slug = 'arrabbiata-sauce-user' and owner_id = :owner_id),
  null, null, null,
  false, null, 0, 'sauce'
from recipes r where r.slug = 'arrabbiata-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'parmigiano-reggiano' and owner_id is null),
  null,
  null, null, null,
  false, null, 1, 'parmesan'
from recipes r where r.slug = 'arrabbiata-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'italian-sausage' and owner_id is null),
  null,
  null, null, null,
  false, null, 2, 'sausage'
from recipes r where r.slug = 'arrabbiata-user' and r.owner_id = :owner_id;
delete from recipe_steps where recipe_id = (select id from recipes where slug = 'arrabbiata-user' and owner_id = :owner_id);
delete from recipe_sources where recipe_id = (select id from recipes where slug = 'arrabbiata-user' and owner_id = :owner_id);
insert into recipe_sources (recipe_id, source_type, author, title, url, attribution, credibility_tier)
select r.id, 'user'::source_type, null, null,
  null, null, 0.7
from recipes r where r.slug = 'arrabbiata-user' and r.owner_id = :owner_id;
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe_item', (select i.id from recipe_items i join recipes r on r.id = i.recipe_id where r.slug = 'arrabbiata-user' and r.owner_id = :owner_id and i.item_key = 'sausage'), 'item.ingredient', 0,
    'needs_review'::review_state, null)
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Вид колбаски не указан. Не подставлять произвольную колбасу — уточните у владельца.'),
  ('en'::app_locale, 'The kind of sausage was never specified. Do not substitute an arbitrary sausage; ask the owner.'),
  ('fr'::app_locale, 'Le type de saucisse n’a pas été précisé. Ne pas substituer une saucisse quelconque.')
) as t(locale, note);

delete from recipe_items where recipe_id = (select id from recipes where slug = 'pear-gorgonzola-user' and owner_id = :owner_id);
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'pear' and owner_id is null),
  null,
  null, null, null,
  false, null, 0, 'pear'
from recipes r where r.slug = 'pear-gorgonzola-user' and r.owner_id = :owner_id;
insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  (select id from ingredients where slug = 'gorgonzola' and owner_id is null),
  null,
  null, null, null,
  false, null, 1, 'gorgonzola'
from recipes r where r.slug = 'pear-gorgonzola-user' and r.owner_id = :owner_id;
delete from recipe_steps where recipe_id = (select id from recipes where slug = 'pear-gorgonzola-user' and owner_id = :owner_id);
delete from recipe_sources where recipe_id = (select id from recipes where slug = 'pear-gorgonzola-user' and owner_id = :owner_id);
insert into recipe_sources (recipe_id, source_type, author, title, url, attribution, credibility_tier)
select r.id, 'user'::source_type, null, null,
  null, null, 0.7
from recipes r where r.slug = 'pear-gorgonzola-user' and r.owner_id = :owner_id;
with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, 'recipe', (select id from recipes where slug = 'pear-gorgonzola-user' and owner_id = :owner_id), 'recipe.items', 0,
    'needs_review'::review_state, null)
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ('ru'::app_locale, 'Количества не заданы владельцем — заполните их, чтобы включить пересчёт и список покупок.'),
  ('en'::app_locale, 'The owner did not state amounts — fill them in to enable scaling and the shopping list.'),
  ('fr'::app_locale, 'Les quantités ne sont pas renseignées — complétez-les pour activer le calcul et la liste de courses.')
) as t(locale, note);

commit;

