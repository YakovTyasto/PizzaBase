/**
 * Generates `supabase/seed.sql` from the TypeScript seed catalog.
 *
 * The catalog is authored once in `src/lib/seed` and projected two ways: demo
 * mode reads it directly, and this script emits SQL for a real database. That
 * is what keeps the two from drifting.
 *
 * Every statement is an upsert keyed by a stable slug, so running the seed
 * repeatedly converges on the same rows instead of duplicating them. The one
 * argument the script needs at run time is the owner's user id, which recipes
 * and evidence are attributed to.
 *
 * Run with: npm run seed
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { seedCatalog } from '../src/lib/seed'
import type { SeedAmount, SeedRecipe } from '../src/lib/seed/types'

const OUT = path.join(process.cwd(), 'supabase', 'seed.sql')
const LOCALES = ['ru', 'en', 'fr'] as const

/** Single-quote escaping. Every literal in the output goes through this. */
function q(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'null'
  return `'${value.replace(/'/g, "''")}'`
}

function num(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'null'
  return String(value)
}

function bool(value: boolean | undefined): string {
  return value ? 'true' : 'false'
}

function textArray(values: string[] | undefined): string {
  if (!values || values.length === 0) return `'{}'`
  return `ARRAY[${values.map(q).join(', ')}]::text[]`
}

/** Splits an amount into the (amount, amount_max, unit) column triple. */
function amountColumns(amount: SeedAmount): { amount: string; max: string; unit: string } {
  switch (amount.kind) {
    case 'exact':
      return { amount: amount.value, max: 'null', unit: q(amount.unit) }
    case 'range':
      return { amount: amount.min, max: amount.max, unit: q(amount.unit) }
    case 'qualitative':
      // A qualitative line stores its unit and no number at all.
      return { amount: 'null', max: 'null', unit: q(amount.unit) }
    case 'unknown':
      // Both null: an honest "we do not know", never a zero.
      return { amount: 'null', max: 'null', unit: 'null' }
  }
}

const lines: string[] = []
const write = (line = '') => lines.push(line)

function header() {
  write('-- Impasto seed data.')
  write('--')
  write('-- GENERATED FILE - do not edit by hand.')
  write('-- Source: src/lib/seed/*.ts     Regenerate: npm run seed')
  write('--')
  write('-- Idempotent: every statement upserts on a stable slug, so re-running')
  write('-- this file converges rather than duplicating.')
  write('--')
  write('-- Usage:')
  write('--   psql "$DATABASE_URL" -v owner_id="\'<auth.users.id>\'" -f supabase/seed.sql')
  write('--')
  write('-- The shared catalog (categories, ingredients, styles, ovens) is owned by')
  write('-- nobody (owner_id is null) and is readable by every signed-in user.')
  write('-- Recipes belong to :owner_id.')
  write()
  write('\\set ON_ERROR_STOP on')
  write()
  write('begin;')
  write()
}

function categories() {
  write('-- ---------------------------------------------------------------------------')
  write('-- Categories')
  write('-- ---------------------------------------------------------------------------')
  for (const category of seedCatalog.categories) {
    write(
      `insert into ingredient_categories (slug, sort_order) values (${q(category.slug)}, ${category.sortOrder})`,
    )
    write('  on conflict (slug) do update set sort_order = excluded.sort_order;')
    for (const locale of LOCALES) {
      write(
        `insert into ingredient_category_translations (category_id, locale, name) ` +
          `select id, ${q(locale)}, ${q(category.names[locale])} from ingredient_categories where slug = ${q(category.slug)}`,
      )
      write('  on conflict (category_id, locale) do update set name = excluded.name;')
    }
  }
  write()
}

function styles() {
  write('-- ---------------------------------------------------------------------------')
  write('-- Styles and oven profiles')
  write('-- ---------------------------------------------------------------------------')
  for (const style of seedCatalog.styles) {
    write(`insert into styles (slug) values (${q(style.slug)}) on conflict (slug) do nothing;`)
    for (const locale of LOCALES) {
      write(
        `insert into style_translations (style_id, locale, name, description) ` +
          `select id, ${q(locale)}, ${q(style.names[locale])}, ${q(style.descriptions[locale])} from styles where slug = ${q(style.slug)}`,
      )
      write(
        '  on conflict (style_id, locale) do update set name = excluded.name, description = excluded.description;',
      )
    }
  }

  for (const oven of seedCatalog.ovenProfiles) {
    write(
      `insert into oven_profiles (owner_id, slug, max_temperature_c) values (null, ${q(oven.slug)}, ${oven.maxTemperatureC})`,
    )
    write(
      '  on conflict (slug) where owner_id is null do update set max_temperature_c = excluded.max_temperature_c;',
    )
    for (const locale of LOCALES) {
      write(
        `insert into oven_profile_translations (oven_profile_id, locale, name) ` +
          `select id, ${q(locale)}, ${q(oven.names[locale])} from oven_profiles where slug = ${q(oven.slug)} and owner_id is null`,
      )
      write('  on conflict (oven_profile_id, locale) do update set name = excluded.name;')
    }
  }
  write()
}

function ingredients() {
  write('-- ---------------------------------------------------------------------------')
  write('-- Ingredients, translations and aliases')
  write('-- ---------------------------------------------------------------------------')

  for (const ingredient of seedCatalog.ingredients) {
    write(
      `insert into ingredients (owner_id, slug, category_id, measure, base_unit, density_g_per_ml, allergens)`,
    )
    write(
      `select null, ${q(ingredient.slug)}, c.id, ${q(ingredient.measure)}::measure_kind, ${q(ingredient.baseUnit)}::unit_code, ` +
        `${num(ingredient.densityGPerMl)}, ${textArray(ingredient.allergens)}`,
    )
    write(`from ingredient_categories c where c.slug = ${q(ingredient.categorySlug)}`)
    write('  on conflict (slug) where owner_id is null do update set')
    write('    category_id = excluded.category_id,')
    write('    measure = excluded.measure,')
    write('    base_unit = excluded.base_unit,')
    write('    density_g_per_ml = excluded.density_g_per_ml,')
    write('    allergens = excluded.allergens;')

    for (const locale of LOCALES) {
      write(
        `insert into ingredient_translations (ingredient_id, locale, name) ` +
          `select id, ${q(locale)}, ${q(ingredient.names[locale])} from ingredients where slug = ${q(ingredient.slug)} and owner_id is null`,
      )
      write('  on conflict (ingredient_id, locale) do update set name = excluded.name;')
    }
  }

  // Parent links are set in a second pass so forward references resolve.
  write()
  write('-- Parent links (second pass so forward references resolve)')
  for (const ingredient of seedCatalog.ingredients) {
    if (!ingredient.parentSlug) continue
    write(
      `update ingredients set parent_id = (select id from ingredients where slug = ${q(ingredient.parentSlug)} and owner_id is null) ` +
        `where slug = ${q(ingredient.slug)} and owner_id is null;`,
    )
  }

  write()
  write('-- Aliases. Deleted and reinserted so removals in the catalog take effect.')
  for (const ingredient of seedCatalog.ingredients) {
    const aliases = Object.entries(ingredient.aliases ?? {}).flatMap(([locale, list]) =>
      (list ?? []).map((alias) => ({ locale, alias })),
    )
    // The canonical names are aliases too, so search finds them.
    for (const locale of LOCALES) aliases.push({ locale, alias: ingredient.names[locale] })
    if (aliases.length === 0) continue

    write(
      `delete from ingredient_aliases where ingredient_id = (select id from ingredients where slug = ${q(ingredient.slug)} and owner_id is null);`,
    )
    const values = aliases
      .map(
        ({ locale, alias }) =>
          `((select id from ingredients where slug = ${q(ingredient.slug)} and owner_id is null), ${q(locale)}::app_locale, ${q(alias)})`,
      )
      .join(',\n  ')
    write(`insert into ingredient_aliases (ingredient_id, locale, alias) values`)
    write(`  ${values};`)
  }
  write()
}

function packagesAndSubstitutions() {
  write('-- ---------------------------------------------------------------------------')
  write('-- Package options and substitutions')
  write('-- ---------------------------------------------------------------------------')

  for (const option of seedCatalog.packageOptions) {
    const columns = amountColumns(option.netAmount)
    write(
      `insert into ingredient_package_options (owner_id, slug, ingredient_id, package_type, net_quantity, unit, brand, barcode, source_url, preferred)`,
    )
    write(
      `select null, ${q(option.slug)}, i.id, ${q(option.packageType)}::package_type, ${columns.amount}, ${columns.unit}::unit_code, ` +
        `${q(option.brand)}, ${q(option.barcode)}, ${q(option.sourceUrl)}, ${bool(option.preferred)}`,
    )
    write(`from ingredients i where i.slug = ${q(option.ingredientSlug)} and i.owner_id is null`)
    write('  on conflict (slug) where owner_id is null do update set')
    write('    net_quantity = excluded.net_quantity,')
    write('    unit = excluded.unit,')
    write('    preferred = excluded.preferred;')

    for (const locale of LOCALES) {
      write(
        `insert into ingredient_package_option_translations (package_option_id, locale, label) ` +
          `select id, ${q(locale)}, ${q(option.labels[locale])} from ingredient_package_options where slug = ${q(option.slug)} and owner_id is null`,
      )
      write('  on conflict (package_option_id, locale) do update set label = excluded.label;')
    }
  }

  write()
  write('-- Substitutions, including the deliberately unapproved rows that exist so')
  write('-- the UI can explain why a swap is refused.')
  write('delete from ingredient_substitutions where owner_id is null;')
  for (const substitution of seedCatalog.substitutions) {
    write(
      `with inserted as (
  insert into ingredient_substitutions (owner_id, from_ingredient_id, to_ingredient_id, style_id, quality_grade, approved)
  select null,
    (select id from ingredients where slug = ${q(substitution.fromSlug)} and owner_id is null),
    (select id from ingredients where slug = ${q(substitution.toSlug)} and owner_id is null),
    ${substitution.styleSlug ? `(select id from styles where slug = ${q(substitution.styleSlug)})` : 'null'},
    ${q(substitution.qualityGrade)}::substitution_grade,
    ${bool(substitution.approved)}
  returning id
)
insert into ingredient_substitution_translations (substitution_id, locale, explanation)
select inserted.id, locale, explanation from inserted
cross join (values
  ${LOCALES.map((locale) => `(${q(locale)}::app_locale, ${q(substitution.explanations[locale])})`).join(',\n  ')}
) as t(locale, explanation);`,
    )
  }
  write()
}

function recipeRow(recipe: SeedRecipe) {
  write(`-- ${recipe.slug}`)
  write(
    `insert into recipes (owner_id, slug, type, status, authenticity, style_id, oven_profile_id, origin_locale,
  base_yield, yield_unit, base_diameter_mm, base_shape, base_tray_width_mm, base_tray_height_mm,
  base_ball_weight_g, active_minutes, passive_minutes, difficulty, tags)
values (
  :owner_id, ${q(recipe.slug)}, ${q(recipe.type)}::recipe_type, ${q(recipe.status)}::recipe_status,
  ${q(recipe.authenticity)}::authenticity_class,
  ${recipe.styleSlug ? `(select id from styles where slug = ${q(recipe.styleSlug)})` : 'null'},
  ${recipe.ovenProfileSlug ? `(select id from oven_profiles where slug = ${q(recipe.ovenProfileSlug)} and owner_id is null)` : 'null'},
  ${q(recipe.originLocale)}::app_locale,
  ${num(recipe.baseYield)}, ${recipe.yieldUnit ? `${q(recipe.yieldUnit)}::unit_code` : 'null'},
  ${num(recipe.baseDiameterMm)}, ${recipe.baseShape ? `${q(recipe.baseShape)}::pizza_shape` : 'null'},
  ${num(recipe.baseTrayWidthMm)}, ${num(recipe.baseTrayHeightMm)},
  ${num(recipe.baseBallWeightG)}, ${num(recipe.activeMinutes)}, ${num(recipe.passiveMinutes)},
  ${num(recipe.difficulty)}, ${textArray(recipe.tags)}
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
  tags = excluded.tags;`,
  )

  for (const locale of LOCALES) {
    write(
      `insert into recipe_translations (recipe_id, locale, name, summary, notes) ` +
        `select id, ${q(locale)}, ${q(recipe.names[locale])}, ${q(recipe.summaries[locale])}, ${q(recipe.notes?.[locale])} ` +
        `from recipes where slug = ${q(recipe.slug)} and owner_id = :owner_id`,
    )
    write(
      '  on conflict (recipe_id, locale) do update set name = excluded.name, summary = excluded.summary, notes = excluded.notes;',
    )
  }
}

function recipeChildren(recipe: SeedRecipe) {
  // Items and steps are replaced wholesale so an edit in the catalog is
  // reflected exactly, rather than accumulating stale rows.
  write(
    `delete from recipe_items where recipe_id = (select id from recipes where slug = ${q(recipe.slug)} and owner_id = :owner_id);`,
  )

  for (const [index, item] of recipe.items.entries()) {
    const columns = amountColumns(item.amount)
    write(
      `insert into recipe_items (recipe_id, ingredient_id, component_recipe_id, amount, amount_max, unit, optional, item_group, sort_order, item_key)
select r.id,
  ${item.ingredientSlug ? `(select id from ingredients where slug = ${q(item.ingredientSlug)} and owner_id is null)` : 'null'},
  ${item.componentSlug ? `(select id from recipes where slug = ${q(item.componentSlug)} and owner_id = :owner_id)` : 'null'},
  ${columns.amount}, ${columns.max}, ${columns.unit}${columns.unit === 'null' ? '' : '::unit_code'},
  ${bool(item.optional)}, ${q(item.group)}, ${index}, ${q(item.key)}
from recipes r where r.slug = ${q(recipe.slug)} and r.owner_id = :owner_id;`,
    )
  }

  write(
    `delete from recipe_steps where recipe_id = (select id from recipes where slug = ${q(recipe.slug)} and owner_id = :owner_id);`,
  )

  for (const [index, step] of recipe.steps.entries()) {
    write(
      `insert into recipe_steps (recipe_id, step_key, sort_order, phase, active_minutes, wait_min_minutes, wait_max_minutes, duration_known, temperature_c, timer_seconds)
select r.id, ${q(step.key)}, ${index}, ${q(step.phase)}::step_phase, ${step.activeMinutes ?? 0},
  ${step.waitMinMinutes ?? 0}, ${step.waitMaxMinutes ?? step.waitMinMinutes ?? 0},
  ${bool(step.durationKnown ?? true)}, ${num(step.temperatureC)}, ${num(step.timerSeconds)}
from recipes r where r.slug = ${q(recipe.slug)} and r.owner_id = :owner_id;`,
    )

    for (const locale of LOCALES) {
      write(
        `insert into recipe_step_translations (step_id, locale, instruction, sensory_cues, troubleshooting)
select s.id, ${q(locale)}, ${q(step.instructions[locale])}, ${q(step.cues?.[locale])}, ${q(step.troubleshooting?.[locale])}
from recipe_steps s
join recipes r on r.id = s.recipe_id
where r.slug = ${q(recipe.slug)} and r.owner_id = :owner_id and s.step_key = ${q(step.key)}
on conflict (step_id, locale) do update set
  instruction = excluded.instruction,
  sensory_cues = excluded.sensory_cues,
  troubleshooting = excluded.troubleshooting;`,
      )
    }

    for (const itemKey of step.itemKeys ?? []) {
      write(
        `insert into recipe_step_items (step_id, item_id)
select s.id, i.id
from recipe_steps s
join recipes r on r.id = s.recipe_id
join recipe_items i on i.recipe_id = r.id and i.item_key = ${q(itemKey)}
where r.slug = ${q(recipe.slug)} and r.owner_id = :owner_id and s.step_key = ${q(step.key)}
on conflict (step_id, item_id) do nothing;`,
      )
    }
  }

  if (recipe.source) {
    write(
      `delete from recipe_sources where recipe_id = (select id from recipes where slug = ${q(recipe.slug)} and owner_id = :owner_id);`,
    )
    write(
      `insert into recipe_sources (recipe_id, source_type, author, title, url, attribution, credibility_tier)
select r.id, ${q(recipe.source.sourceType)}::source_type, ${q(recipe.source.author)}, ${q(recipe.source.title)},
  ${q(recipe.source.url)}, ${q(recipe.source.attribution)}, ${recipe.source.credibilityTier}
from recipes r where r.slug = ${q(recipe.slug)} and r.owner_id = :owner_id;`,
    )
  }

  for (const evidence of recipe.evidence ?? []) {
    // Evidence attaches to the recipe itself or to one specific item, which is
    // what lets a single disputed salt weight be flagged on its own.
    const entityType = evidence.itemKey ? 'recipe_item' : 'recipe'
    const entitySelect = evidence.itemKey
      ? `(select i.id from recipe_items i join recipes r on r.id = i.recipe_id where r.slug = ${q(recipe.slug)} and r.owner_id = :owner_id and i.item_key = ${q(evidence.itemKey)})`
      : `(select id from recipes where slug = ${q(recipe.slug)} and owner_id = :owner_id)`

    write(
      `with e as (
  insert into field_evidence (owner_id, entity_type, entity_id, field, confidence, review_state, conflict_group)
  values (:owner_id, ${q(entityType)}, ${entitySelect}, ${q(evidence.field)}, ${evidence.confidence},
    ${q(evidence.reviewState)}::review_state, ${q(evidence.conflictGroup)})
  returning id
)
insert into field_evidence_translations (evidence_id, locale, note)
select e.id, locale, note from e
cross join (values
  ${LOCALES.map((locale) => `(${q(locale)}::app_locale, ${q(evidence.notes[locale])})`).join(',\n  ')}
) as t(locale, note);`,
    )
  }
  write()
}

function recipes() {
  write('-- ---------------------------------------------------------------------------')
  write('-- Recipes')
  write('--')
  write('-- Components are inserted before the pizzas that reference them, so the')
  write('-- component lookups below always resolve.')
  write('-- ---------------------------------------------------------------------------')
  write()
  write('-- Evidence is rebuilt from scratch on every run.')
  write(
    `delete from field_evidence where owner_id = :owner_id and entity_type in ('recipe', 'recipe_item');`,
  )
  write()

  // Components first: a pizza's component_recipe_id lookup must resolve.
  const components = seedCatalog.recipes.filter((recipe) => recipe.type !== 'pizza')
  const pizzas = seedCatalog.recipes.filter((recipe) => recipe.type === 'pizza')

  for (const recipe of [...components, ...pizzas]) recipeRow(recipe)
  write()
  for (const recipe of [...components, ...pizzas]) recipeChildren(recipe)
}

async function main() {
  header()
  categories()
  styles()
  ingredients()
  packagesAndSubstitutions()
  recipes()

  write('commit;')
  write()

  await mkdir(path.dirname(OUT), { recursive: true })
  await writeFile(OUT, `${lines.join('\n')}\n`, 'utf8')

  console.log(`Wrote ${path.relative(process.cwd(), OUT)}`)
  console.log(
    `  ${seedCatalog.ingredients.length} ingredients, ${seedCatalog.recipes.length} recipes, ` +
      `${seedCatalog.packageOptions.length} package options, ${seedCatalog.substitutions.length} substitutions`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
