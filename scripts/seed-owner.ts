/**
 * Seeds the bundled catalog into a real Supabase project, for one owner.
 *
 * Written so a first deployment does not require `psql`. The alternative --
 * "run supabase/seed.sql against your database" -- needs a Postgres client, a
 * direct connection string and a command line most people on Windows do not
 * have. This needs the service-role key from the dashboard and nothing else:
 *
 *   npm run seed:owner -- <supabase-user-uuid>
 *
 * The uuid is the id of the row in `auth.users` for the account that will own
 * the catalog: Authentication -> Users in the Supabase dashboard.
 *
 * Idempotent by construction. Shared catalog rows are matched by slug and
 * updated in place; a recipe's children are rewritten wholesale from the seed,
 * because a recipe is a document rather than a set of independently-editable
 * rows. Running it a second time converges on the same state and creates no
 * duplicates -- so it is safe to re-run after editing the seed.
 *
 * The service-role key bypasses Row Level Security, which is exactly why it is
 * read here, in a script that never runs in a browser, and never through any
 * NEXT_PUBLIC_ variable.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { seedCatalog } from '../src/lib/seed'
import type { SeedAmount, SeedRecipe } from '../src/lib/seed/types'

const LOCALES = ['ru', 'en', 'fr'] as const

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/**
 * Reads `.env.local` without adding a dependency.
 *
 * Next.js loads it for the app but not for a plain `tsx` script, and a seeding
 * command that cannot see the same file the app uses would be a trap.
 */
function loadEnvLocal(): void {
  const file = path.join(process.cwd(), '.env.local')
  let contents: string
  try {
    contents = readFileSync(file, 'utf8')
  } catch {
    return
  }

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator === -1) continue

    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    // A real environment variable wins: that is how CI overrides the file.
    if (process.env[key] === undefined) process.env[key] = value
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUserId(value: string | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim())
}

// ---------------------------------------------------------------------------
// Shape helpers
// ---------------------------------------------------------------------------

/** Splits an amount into the (amount, amount_max, unit) column triple. */
export function amountColumns(amount: SeedAmount): {
  amount: string | null
  amount_max: string | null
  unit: string | null
} {
  switch (amount.kind) {
    case 'exact':
      return { amount: amount.value, amount_max: null, unit: amount.unit }
    case 'range':
      return { amount: amount.min, amount_max: amount.max, unit: amount.unit }
    case 'qualitative':
      // A qualitative line stores its unit and no number at all.
      return { amount: null, amount_max: null, unit: amount.unit }
    case 'unknown':
      // Both null: an honest "we do not know", never a zero.
      return { amount: null, amount_max: null, unit: null }
  }
}

/** Recipes must exist before any item can point at one as a component. */
export function recipeInsertOrder(recipes: readonly SeedRecipe[]): SeedRecipe[] {
  const bySlug = new Map(recipes.map((recipe) => [recipe.slug, recipe]))
  const ordered: SeedRecipe[] = []
  const placed = new Set<string>()

  const visit = (recipe: SeedRecipe, seen: Set<string>) => {
    if (placed.has(recipe.slug)) return
    if (seen.has(recipe.slug)) return // A cycle is the database's to reject.
    seen.add(recipe.slug)
    for (const item of recipe.items) {
      const component = item.componentSlug ? bySlug.get(item.componentSlug) : undefined
      if (component) visit(component, seen)
    }
    placed.add(recipe.slug)
    ordered.push(recipe)
  }

  for (const recipe of recipes) visit(recipe, new Set())
  return ordered
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

interface Counts {
  categories: number
  ingredients: number
  styles: number
  ovenProfiles: number
  packageOptions: number
  substitutions: number
  recipes: number
}

/**
 * A deliberately open schema for the client.
 *
 * `npm run db:types` generates a precise `Database` type from a running local
 * project, which not everyone seeding a hosted project will have. Without a
 * schema the client infers `never` for every insert payload and rejects them
 * all, so this states the shape loosely: table names are strings and rows are
 * plain objects. The database still enforces the real column types, and every
 * failure is reported by `check()` with the step that caused it.
 */
type SeedRow = Record<string, unknown>

interface SeedSchema {
  public: {
    Tables: Record<string, { Row: SeedRow; Insert: SeedRow; Update: SeedRow; Relationships: [] }>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type Client = ReturnType<typeof createClient<SeedSchema>>

/** Throws with the operation's name attached, so a failure says where it was. */
function check(step: string, error: { message: string } | null): void {
  if (error) throw new Error(`${step}: ${error.message}`)
}

async function idsBySlug(
  client: Client,
  table: string,
  slugs: string[],
): Promise<Map<string, string>> {
  const { data, error } = await client.from(table).select('id, slug').in('slug', slugs)
  check(`read ${table}`, error)
  return new Map(((data ?? []) as { id: string; slug: string }[]).map((row) => [row.slug, row.id]))
}

/**
 * Upserts rows keyed by slug without relying on ON CONFLICT.
 *
 * The catalog tables use *partial* unique indexes (`where owner_id is null`),
 * which PostgREST cannot infer a conflict target from. Reading first and then
 * splitting into inserts and updates gets the same result and stays honest
 * about which rows already existed.
 */
async function upsertBySlug(
  client: Client,
  table: string,
  rows: SeedRow[],
): Promise<Map<string, string>> {
  if (rows.length === 0) return new Map()
  const slugs = rows.map((row) => String(row.slug))
  const existing = await idsBySlug(client, table, slugs)

  const toInsert = rows.filter((row) => !existing.has(String(row.slug)))
  if (toInsert.length > 0) {
    const { error } = await client.from(table).insert(toInsert)
    check(`insert ${table}`, error)
  }

  for (const row of rows) {
    const id = existing.get(String(row.slug))
    if (!id) continue
    const { error } = await client.from(table).update(row).eq('id', id)
    check(`update ${table}`, error)
  }

  return idsBySlug(client, table, slugs)
}

async function replaceTranslations(
  client: Client,
  table: string,
  key: string,
  rows: SeedRow[],
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return
  const { error: deleteError } = await client.from(table).delete().in(key, ids)
  check(`clear ${table}`, deleteError)
  if (rows.length === 0) return
  const { error } = await client.from(table).insert(rows)
  check(`insert ${table}`, error)
}

async function seedCatalogTables(client: Client, owner: string): Promise<Counts> {
  const catalog = seedCatalog

  // --- Categories ---------------------------------------------------------
  const categoryIds = await upsertBySlug(
    client,
    'ingredient_categories',
    catalog.categories.map((category) => ({
      slug: category.slug,
      sort_order: category.sortOrder,
    })),
  )
  await replaceTranslations(
    client,
    'ingredient_category_translations',
    'category_id',
    catalog.categories.flatMap((category) =>
      LOCALES.map((locale) => ({
        category_id: categoryIds.get(category.slug),
        locale,
        name: category.names[locale],
      })),
    ),
    [...categoryIds.values()],
  )

  // --- Styles and ovens ---------------------------------------------------
  const styleIds = await upsertBySlug(
    client,
    'styles',
    catalog.styles.map((style) => ({ slug: style.slug })),
  )
  await replaceTranslations(
    client,
    'style_translations',
    'style_id',
    catalog.styles.flatMap((style) =>
      LOCALES.map((locale) => ({
        style_id: styleIds.get(style.slug),
        locale,
        name: style.names[locale],
        description: style.descriptions[locale],
      })),
    ),
    [...styleIds.values()],
  )

  const ovenIds = await upsertBySlug(
    client,
    'oven_profiles',
    catalog.ovenProfiles.map((oven) => ({
      slug: oven.slug,
      max_temperature_c: oven.maxTemperatureC,
    })),
  )
  await replaceTranslations(
    client,
    'oven_profile_translations',
    'oven_profile_id',
    catalog.ovenProfiles.flatMap((oven) =>
      LOCALES.map((locale) => ({
        oven_profile_id: ovenIds.get(oven.slug),
        locale,
        name: oven.names[locale],
      })),
    ),
    [...ovenIds.values()],
  )

  // --- Ingredients --------------------------------------------------------
  const ingredientIds = await upsertBySlug(
    client,
    'ingredients',
    catalog.ingredients.map((ingredient) => ({
      slug: ingredient.slug,
      category_id: categoryIds.get(ingredient.categorySlug) ?? null,
      measure: ingredient.measure,
      base_unit: ingredient.baseUnit,
      density_g_per_ml: ingredient.densityGPerMl ?? null,
      allergens: ingredient.allergens ?? [],
    })),
  )

  // Parent links need every ingredient to exist first.
  for (const ingredient of catalog.ingredients) {
    if (!ingredient.parentSlug) continue
    const { error } = await client
      .from('ingredients')
      .update({ parent_id: ingredientIds.get(ingredient.parentSlug) ?? null })
      .eq('id', ingredientIds.get(ingredient.slug)!)
    check('link ingredient parent', error)
  }

  await replaceTranslations(
    client,
    'ingredient_translations',
    'ingredient_id',
    catalog.ingredients.flatMap((ingredient) =>
      LOCALES.map((locale) => ({
        ingredient_id: ingredientIds.get(ingredient.slug),
        locale,
        name: ingredient.names[locale],
        description: ingredient.notes?.[locale] ?? null,
      })),
    ),
    [...ingredientIds.values()],
  )
  await replaceTranslations(
    client,
    'ingredient_aliases',
    'ingredient_id',
    catalog.ingredients.flatMap((ingredient) =>
      LOCALES.flatMap((locale) =>
        (ingredient.aliases?.[locale] ?? []).map((alias) => ({
          ingredient_id: ingredientIds.get(ingredient.slug),
          locale,
          alias,
        })),
      ),
    ),
    [...ingredientIds.values()],
  )

  // --- Package options ----------------------------------------------------
  const packageIds = await upsertBySlug(
    client,
    'ingredient_package_options',
    catalog.packageOptions.map((option) => {
      const columns = amountColumns(option.netAmount)
      return {
        slug: option.slug,
        ingredient_id: ingredientIds.get(option.ingredientSlug) ?? null,
        brand: option.brand ?? null,
        package_type: option.packageType,
        net_quantity: columns.amount,
        unit: columns.unit,
        barcode: option.barcode ?? null,
        source_url: option.sourceUrl ?? null,
        preferred: option.preferred ?? false,
      }
    }),
  )
  await replaceTranslations(
    client,
    'ingredient_package_option_translations',
    'package_option_id',
    catalog.packageOptions.flatMap((option) =>
      LOCALES.map((locale) => ({
        package_option_id: packageIds.get(option.slug),
        locale,
        label: option.labels[locale],
      })),
    ),
    [...packageIds.values()],
  )

  // --- Substitutions ------------------------------------------------------
  // No slug of their own, so the shared set is replaced wholesale.
  const { error: clearSubs } = await client
    .from('ingredient_substitutions')
    .delete()
    .is('owner_id', null)
  check('clear substitutions', clearSubs)

  if (catalog.substitutions.length > 0) {
    const { data, error } = await client
      .from('ingredient_substitutions')
      .insert(
        catalog.substitutions.map((substitution) => ({
          from_ingredient_id: ingredientIds.get(substitution.fromSlug),
          to_ingredient_id: ingredientIds.get(substitution.toSlug),
          style_id: substitution.styleSlug ? (styleIds.get(substitution.styleSlug) ?? null) : null,
          quality_grade: substitution.qualityGrade,
          approved: substitution.approved,
        })),
      )
      .select('id')
    check('insert substitutions', error)

    const inserted = (data ?? []) as { id: string }[]
    const rows = catalog.substitutions.flatMap((substitution, index) =>
      LOCALES.map((locale) => ({
        substitution_id: inserted[index]?.id,
        locale,
        explanation: substitution.explanations[locale],
      })),
    )
    const { error: translationError } = await client
      .from('ingredient_substitution_translations')
      .insert(rows.filter((row) => row.substitution_id))
    check('insert substitution translations', translationError)
  }

  // --- Recipes ------------------------------------------------------------
  const ordered = recipeInsertOrder(catalog.recipes)
  const recipeIds = new Map<string, string>()

  for (const recipe of ordered) {
    const row = {
      owner_id: owner,
      slug: recipe.slug,
      type: recipe.type,
      status: recipe.status,
      authenticity: recipe.authenticity,
      style_id: recipe.styleSlug ? (styleIds.get(recipe.styleSlug) ?? null) : null,
      oven_profile_id: recipe.ovenProfileSlug
        ? (ovenIds.get(recipe.ovenProfileSlug) ?? null)
        : null,
      origin_locale: recipe.originLocale,
      base_yield: recipe.baseYield ?? null,
      yield_unit: recipe.yieldUnit ?? null,
      base_diameter_mm: recipe.baseDiameterMm ?? null,
      base_shape: recipe.baseShape ?? null,
      base_tray_width_mm: recipe.baseTrayWidthMm ?? null,
      base_tray_height_mm: recipe.baseTrayHeightMm ?? null,
      base_ball_weight_g: recipe.baseBallWeightG ?? null,
      active_minutes: recipe.activeMinutes ?? null,
      passive_minutes: recipe.passiveMinutes ?? null,
      difficulty: recipe.difficulty ?? null,
      tags: recipe.tags ?? [],
    }

    // `recipes` has a real unique constraint on (owner_id, slug), so this one
    // can use a genuine upsert.
    const { data, error } = await client
      .from('recipes')
      .upsert(row, { onConflict: 'owner_id,slug' })
      .select('id')
      .single()
    check(`upsert recipe ${recipe.slug}`, error)
    recipeIds.set(recipe.slug, (data as { id: string }).id)
  }

  for (const recipe of ordered) {
    const recipeId = recipeIds.get(recipe.slug)!
    await seedRecipeChildren(client, owner, recipe, recipeId, recipeIds, ingredientIds)
  }

  return {
    categories: catalog.categories.length,
    ingredients: catalog.ingredients.length,
    styles: catalog.styles.length,
    ovenProfiles: catalog.ovenProfiles.length,
    packageOptions: catalog.packageOptions.length,
    substitutions: catalog.substitutions.length,
    recipes: catalog.recipes.length,
  }
}

/**
 * Rewrites one recipe's items, steps, source and evidence.
 *
 * Children are deleted and re-inserted rather than diffed. A recipe is one
 * document: partially updating its lines would leave a row from a previous
 * version of the seed behind, and there is no stable per-row identity in the
 * seed to diff against anyway.
 */
async function seedRecipeChildren(
  client: Client,
  owner: string,
  recipe: SeedRecipe,
  recipeId: string,
  recipeIds: Map<string, string>,
  ingredientIds: Map<string, string>,
): Promise<void> {
  // Evidence points at items and steps, so it goes first.
  const { data: oldItems } = await client
    .from('recipe_items')
    .select('id')
    .eq('recipe_id', recipeId)
  const { data: oldSteps } = await client
    .from('recipe_steps')
    .select('id')
    .eq('recipe_id', recipeId)
  const oldEntityIds = [
    recipeId,
    ...((oldItems ?? []) as { id: string }[]).map((row) => row.id),
    ...((oldSteps ?? []) as { id: string }[]).map((row) => row.id),
  ]
  const { error: clearEvidence } = await client
    .from('field_evidence')
    .delete()
    .in('entity_id', oldEntityIds)
  check('clear evidence', clearEvidence)

  const { error: clearItems } = await client.from('recipe_items').delete().eq('recipe_id', recipeId)
  check('clear items', clearItems)
  const { error: clearSteps } = await client.from('recipe_steps').delete().eq('recipe_id', recipeId)
  check('clear steps', clearSteps)
  const { error: clearSources } = await client
    .from('recipe_sources')
    .delete()
    .eq('recipe_id', recipeId)
  check('clear sources', clearSources)

  // --- Translations -------------------------------------------------------
  const { error: clearTranslations } = await client
    .from('recipe_translations')
    .delete()
    .eq('recipe_id', recipeId)
  check('clear recipe translations', clearTranslations)

  const { error: translationError } = await client.from('recipe_translations').insert(
    LOCALES.filter((locale) => recipe.names[locale]).map((locale) => ({
      recipe_id: recipeId,
      locale,
      name: recipe.names[locale],
      summary: recipe.summaries[locale] ?? null,
      notes: recipe.notes?.[locale] ?? null,
    })),
  )
  check('insert recipe translations', translationError)

  // --- Items --------------------------------------------------------------
  const itemIdByKey = new Map<string, string>()
  if (recipe.items.length > 0) {
    const { data, error } = await client
      .from('recipe_items')
      .insert(
        recipe.items.map((item, index) => {
          const columns = amountColumns(item.amount)
          return {
            recipe_id: recipeId,
            ingredient_id: item.ingredientSlug
              ? (ingredientIds.get(item.ingredientSlug) ?? null)
              : null,
            component_recipe_id: item.componentSlug
              ? (recipeIds.get(item.componentSlug) ?? null)
              : null,
            amount: columns.amount,
            amount_max: columns.amount_max,
            unit: columns.unit,
            optional: item.optional ?? false,
            item_group: item.group ?? null,
            sort_order: index,
            item_key: item.key,
          }
        }),
      )
      .select('id, item_key')
    check(`insert items for ${recipe.slug}`, error)
    for (const row of (data ?? []) as { id: string; item_key: string }[]) {
      itemIdByKey.set(row.item_key, row.id)
    }
  }

  // --- Steps --------------------------------------------------------------
  const stepIdByKey = new Map<string, string>()
  if (recipe.steps.length > 0) {
    const { data, error } = await client
      .from('recipe_steps')
      .insert(
        recipe.steps.map((step, index) => ({
          recipe_id: recipeId,
          step_key: step.key,
          sort_order: index,
          phase: step.phase,
          active_minutes: step.activeMinutes ?? 0,
          wait_min_minutes: step.waitMinMinutes ?? 0,
          wait_max_minutes: step.waitMaxMinutes ?? 0,
          duration_known: step.durationKnown ?? true,
          timer_seconds: step.timerSeconds ?? null,
          temperature_c: step.temperatureC ?? null,
        })),
      )
      .select('id, step_key')
    check(`insert steps for ${recipe.slug}`, error)
    for (const row of (data ?? []) as { id: string; step_key: string }[]) {
      stepIdByKey.set(row.step_key, row.id)
    }

    const { error: stepTranslationError } = await client.from('recipe_step_translations').insert(
      recipe.steps.flatMap((step) =>
        LOCALES.filter((locale) => step.instructions[locale]).map((locale) => ({
          step_id: stepIdByKey.get(step.key),
          locale,
          instruction: step.instructions[locale],
          sensory_cues: step.cues?.[locale] ?? null,
          troubleshooting: step.troubleshooting?.[locale] ?? null,
        })),
      ),
    )
    check('insert step translations', stepTranslationError)

    const stepItems = recipe.steps.flatMap((step) =>
      (step.itemKeys ?? []).flatMap((key) => {
        const stepId = stepIdByKey.get(step.key)
        const itemId = itemIdByKey.get(key)
        return stepId && itemId ? [{ step_id: stepId, item_id: itemId }] : []
      }),
    )
    if (stepItems.length > 0) {
      const { error } = await client.from('recipe_step_items').insert(stepItems)
      check('insert step items', error)
    }
  }

  // --- Source -------------------------------------------------------------
  let sourceId: string | null = null
  if (recipe.source) {
    const { data, error } = await client
      .from('recipe_sources')
      .insert({
        recipe_id: recipeId,
        source_type: recipe.source.sourceType,
        author: recipe.source.author ?? null,
        title: recipe.source.title ?? null,
        url: recipe.source.url ?? null,
        attribution: recipe.source.attribution ?? null,
        credibility_tier: recipe.source.credibilityTier,
      })
      .select('id')
      .single()
    check(`insert source for ${recipe.slug}`, error)
    sourceId = (data as { id: string }).id
  }

  // --- Evidence -----------------------------------------------------------
  const evidence = recipe.evidence ?? []
  if (evidence.length > 0) {
    const rows = evidence.map((entry) => {
      const itemId = entry.itemKey ? itemIdByKey.get(entry.itemKey) : undefined
      return {
        owner_id: owner,
        entity_type: itemId ? 'recipe_item' : 'recipe',
        entity_id: itemId ?? recipeId,
        field: entry.field,
        source_id: sourceId,
        confidence: entry.confidence,
        review_state: entry.reviewState,
        conflict_group: entry.conflictGroup ?? null,
      }
    })
    const { data, error } = await client.from('field_evidence').insert(rows).select('id')
    check(`insert evidence for ${recipe.slug}`, error)

    const inserted = (data ?? []) as { id: string }[]
    const notes = evidence.flatMap((entry, index) =>
      LOCALES.filter((locale) => entry.notes[locale]).map((locale) => ({
        evidence_id: inserted[index]?.id,
        locale,
        note: entry.notes[locale],
      })),
    )
    const { error: noteError } = await client
      .from('field_evidence_translations')
      .insert(notes.filter((note) => note.evidence_id))
    check('insert evidence notes', noteError)
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  loadEnvLocal()

  const ownerId = process.argv[2]?.trim()
  if (!isUserId(ownerId)) {
    console.error('Usage: npm run seed:owner -- <supabase-user-uuid>\n')
    console.error('The uuid is the id of the account that will own the catalog.')
    console.error('Find it in the Supabase dashboard under Authentication -> Users.')
    process.exitCode = 1
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    console.error('Missing configuration. Set these in .env.local:\n')
    if (!url) console.error('  NEXT_PUBLIC_SUPABASE_URL   (Project Settings -> API)')
    if (!serviceRoleKey) {
      console.error('  SUPABASE_SERVICE_ROLE_KEY  (Project Settings -> API, "service_role")')
    }
    console.error('\nThe service-role key is server-only. Never expose it to the browser.')
    process.exitCode = 1
    return
  }

  const client = createClient<SeedSchema>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log(`Seeding the bundled catalog for owner ${ownerId}`)
  console.log(`Project: ${new URL(url).host}\n`)

  try {
    const counts = await seedCatalogTables(client, ownerId)
    console.log('Done. The catalog now holds:')
    console.log(`  ${counts.categories} ingredient categories`)
    console.log(`  ${counts.ingredients} ingredients`)
    console.log(`  ${counts.styles} styles`)
    console.log(`  ${counts.ovenProfiles} oven profiles`)
    console.log(`  ${counts.packageOptions} package sizes`)
    console.log(`  ${counts.substitutions} approved substitutions`)
    console.log(`  ${counts.recipes} recipes`)
    console.log('\nSafe to run again: everything is matched by slug and updated in place.')
  } catch (error) {
    console.error('\nSeeding failed. Nothing further was written.')
    console.error(error instanceof Error ? error.message : error)
    console.error('\nCheck that the migrations in supabase/migrations have been applied,')
    console.error('and that the uuid belongs to a real row in auth.users.')
    process.exitCode = 1
  }
}

// Only run when invoked directly, so the helpers above stay unit-testable.
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  void main()
}
