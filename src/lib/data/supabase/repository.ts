import 'server-only'
import { Decimal } from 'decimal.js'
import {
  type Amount,
  type DomainIngredient,
  type DomainRecipe,
  type Locale,
  type PackageOption,
  type RecipeGraph,
  type StorageLocation,
  type Substitution,
  type Unit,
  graphFrom,
  isUnit,
  parseAmount,
} from '@/domain'
import { createClient } from '@/lib/supabase/server'
import { resolveText } from '../localize'
import type { RecipeDraft } from '../recipe-draft'
import { validateDraft } from '../recipe-draft'
import type {
  CategoryView,
  CookSessionView,
  IngredientView,
  MealPlanView,
  PantryItemView,
  RecipeDetail,
  RecipeFilter,
  OpenQuestionView,
  RecipeSummary,
  RecipeVersionView,
  Repository,
  SaveRecipeResult,
  UserSettingsView,
} from '../types'

/**
 * Supabase-backed repository.
 *
 * Every query runs as the signed-in user, so RLS is the enforcing layer and
 * these methods never filter by owner themselves -- doing both would create two
 * places for the rule to drift.
 *
 * Translations arrive as side-table rows and are collapsed into the same
 * `LocalizedText` shape the demo repository produces, so the UI cannot tell the
 * two backends apart.
 */

type TranslationRow = { locale: Locale; [key: string]: unknown }

function collectTranslations<T extends TranslationRow>(
  rows: T[] | null | undefined,
  field: keyof T,
): Partial<Record<Locale, string>> {
  const out: Partial<Record<Locale, string>> = {}
  for (const row of rows ?? []) {
    const value = row[field]
    if (typeof value === 'string' && value.trim()) out[row.locale] = value
  }
  return out
}

function amountFrom(
  amount: number | string | null,
  amountMax: number | string | null,
  unit: string | null,
): Amount {
  return parseAmount({ amount, amount_max: amountMax, unit })
}

function unitOrNull(value: string | null): Unit | null {
  return value && isUnit(value) ? value : null
}

export class SupabaseRepository implements Repository {
  readonly kind = 'supabase' as const

  async listRecipes(locale: Locale, filter: RecipeFilter = {}): Promise<RecipeSummary[]> {
    const supabase = await createClient()

    let query = supabase
      .from('recipes')
      .select(
        `id, slug, type, status, authenticity, style_id, oven_profile_id, origin_locale,
         active_minutes, passive_minutes, difficulty, tags,
         recipe_translations (locale, name, summary),
         recipe_sources (source_type, author, title, url, credibility_tier, attribution),
         styles (id, style_translations (locale, name)),
         oven_profiles (id, oven_profile_translations (locale, name)),
         field_evidence_count:field_evidence (count)`,
      )
      .neq('status', 'archived')

    if (filter.type) query = query.eq('type', filter.type)
    if (filter.status) query = query.eq('status', filter.status)
    if (filter.authenticity) query = query.eq('authenticity', filter.authenticity)
    if (filter.styleId) query = query.eq('style_id', filter.styleId)
    if (filter.ovenProfileId) query = query.eq('oven_profile_id', filter.ovenProfileId)

    const { data, error } = await query
    if (error) throw error

    const summaries = (data ?? []).map((row) => this.toSummary(row as never, locale))

    // Text search runs in memory so it can span all three locales at once;
    // a personal library is small enough that this stays instant.
    const query_ = filter.query?.trim().toLowerCase()
    if (!query_) return summaries
    return summaries.filter(
      (summary) =>
        summary.name.value.toLowerCase().includes(query_) ||
        summary.summary?.value.toLowerCase().includes(query_) ||
        summary.source?.author?.toLowerCase().includes(query_),
    )
  }

  private toSummary(row: Record<string, never>, locale: Locale): RecipeSummary {
    const r = row as unknown as {
      id: string
      slug: string
      type: RecipeSummary['type']
      status: RecipeSummary['status']
      authenticity: RecipeSummary['authenticity']
      style_id: string | null
      oven_profile_id: string | null
      origin_locale: Locale
      active_minutes: number | null
      passive_minutes: number | null
      difficulty: number | null
      tags: string[] | null
      recipe_translations?: { locale: Locale; name: string; summary: string | null }[]
      recipe_sources?: {
        source_type: string
        author: string | null
        title: string | null
        url: string | null
        credibility_tier: number
        attribution: string | null
      }[]
      styles?: { id: string; style_translations?: { locale: Locale; name: string }[] } | null
      oven_profiles?: {
        id: string
        oven_profile_translations?: { locale: Locale; name: string }[]
      } | null
    }

    const source = r.recipe_sources?.[0]

    return {
      id: r.id,
      slug: r.slug,
      type: r.type,
      status: r.status,
      authenticity: r.authenticity,
      styleId: r.style_id,
      styleName: r.styles
        ? resolveText(collectTranslations(r.styles.style_translations, 'name'), locale)
        : null,
      ovenProfileId: r.oven_profile_id,
      ovenName: r.oven_profiles
        ? resolveText(
            collectTranslations(r.oven_profiles.oven_profile_translations, 'name'),
            locale,
          )
        : null,
      name: resolveText(collectTranslations(r.recipe_translations, 'name'), locale, r.origin_locale),
      summary: (() => {
        const translations = collectTranslations(r.recipe_translations, 'summary')
        const resolved = resolveText(translations, locale, r.origin_locale)
        return resolved.value ? resolved : null
      })(),
      activeMinutes: r.active_minutes,
      passiveMinutes: r.passive_minutes,
      difficulty: r.difficulty,
      tags: r.tags ?? [],
      source: source
        ? {
            sourceType: source.source_type as RecipeSummary['source'] extends null
              ? never
              : NonNullable<RecipeSummary['source']>['sourceType'],
            author: source.author,
            title: source.title,
            url: source.url,
            credibilityTier: Number(source.credibility_tier),
            attribution: source.attribution,
          }
        : null,
      openQuestions: 0,
      hasConflict: false,
    }
  }

  async getRecipe(locale: Locale, slug: string): Promise<RecipeDetail | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('recipes')
      .select(
        `id, slug, type, status, authenticity, style_id, oven_profile_id, origin_locale,
         base_yield, yield_unit, base_diameter_mm, base_shape, base_tray_width_mm,
         base_tray_height_mm, base_ball_weight_g, active_minutes, passive_minutes,
         difficulty, tags,
         recipe_translations (locale, name, summary, notes),
         recipe_sources (source_type, author, title, url, credibility_tier, attribution),
         styles (id, style_translations (locale, name)),
         oven_profiles (id, oven_profile_translations (locale, name)),
         recipe_items (
           id, ingredient_id, component_recipe_id, amount, amount_max, unit,
           optional, item_group, sort_order, item_key,
           ingredients (id, slug, ingredient_translations (locale, name)),
           component:recipes!recipe_items_component_recipe_id_fkey (
             id, slug, origin_locale, recipe_translations (locale, name)
           )
         ),
         recipe_steps (
           id, step_key, sort_order, phase, active_minutes, wait_min_minutes,
           wait_max_minutes, duration_known, timer_seconds, temperature_c,
           recipe_step_translations (locale, instruction, sensory_cues, troubleshooting),
           recipe_step_items (item_id)
         )`,
      )
      .eq('slug', slug)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    const row = data as never as Record<string, never>
    const summary = this.toSummary(row, locale)
    const detail = data as unknown as {
      id: string
      origin_locale: Locale
      base_yield: string | null
      yield_unit: string | null
      base_diameter_mm: number | null
      base_shape: RecipeDetail['baseShape']
      base_tray_width_mm: number | null
      base_tray_height_mm: number | null
      base_ball_weight_g: string | null
      recipe_translations?: { locale: Locale; notes: string | null }[]
      recipe_items?: never[]
      recipe_steps?: never[]
    }

    const items = (detail.recipe_items ?? []).map((raw) => {
      const item = raw as unknown as {
        id: string
        ingredient_id: string | null
        component_recipe_id: string | null
        amount: string | null
        amount_max: string | null
        unit: string | null
        optional: boolean
        item_group: string | null
        sort_order: number
        item_key: string | null
        ingredients?: { ingredient_translations?: { locale: Locale; name: string }[] } | null
        component?: {
          origin_locale: Locale
          recipe_translations?: { locale: Locale; name: string }[]
        } | null
      }

      const name = item.ingredients
        ? resolveText(collectTranslations(item.ingredients.ingredient_translations, 'name'), locale)
        : item.component
          ? resolveText(
              collectTranslations(item.component.recipe_translations, 'name'),
              locale,
              item.component.origin_locale,
            )
          : { value: '', fallbackFrom: null }

      return {
        id: item.id,
        key: item.item_key ?? item.id,
        ingredientId: item.ingredient_id,
        componentRecipeId: item.component_recipe_id,
        name,
        amount: amountFrom(item.amount, item.amount_max, item.unit),
        optional: item.optional,
        group: item.item_group,
        note: null,
        sortOrder: item.sort_order,
      }
    })

    const steps = (detail.recipe_steps ?? []).map((raw) => {
      const step = raw as unknown as {
        id: string
        step_key: string | null
        sort_order: number
        phase: RecipeDetail['steps'][number]['phase']
        active_minutes: number
        wait_min_minutes: number
        wait_max_minutes: number
        duration_known: boolean
        timer_seconds: number | null
        temperature_c: string | null
        recipe_step_translations?: {
          locale: Locale
          instruction: string
          sensory_cues: string | null
          troubleshooting: string | null
        }[]
        recipe_step_items?: { item_id: string }[]
      }

      const cues = resolveText(
        collectTranslations(step.recipe_step_translations, 'sensory_cues'),
        locale,
        detail.origin_locale,
      )
      const troubleshooting = resolveText(
        collectTranslations(step.recipe_step_translations, 'troubleshooting'),
        locale,
        detail.origin_locale,
      )

      return {
        id: step.id,
        key: step.step_key ?? step.id,
        phase: step.phase,
        sortOrder: step.sort_order,
        activeMinutes: step.active_minutes,
        waitMinMinutes: step.wait_min_minutes,
        waitMaxMinutes: step.wait_max_minutes,
        durationKnown: step.duration_known,
        temperatureC: step.temperature_c === null ? null : Number(step.temperature_c),
        timerSeconds: step.timer_seconds,
        itemIds: (step.recipe_step_items ?? []).map((link) => link.item_id),
        instruction: resolveText(
          collectTranslations(step.recipe_step_translations, 'instruction'),
          locale,
          detail.origin_locale,
        ),
        cues: cues.value ? cues : null,
        troubleshooting: troubleshooting.value ? troubleshooting : null,
      }
    })

    const { data: evidenceRows } = await supabase
      .from('field_evidence')
      .select(
        `id, entity_type, entity_id, field, confidence, review_state, conflict_group,
         field_evidence_translations (locale, note)`,
      )
      .in('entity_id', [detail.id, ...items.map((i) => i.id)])

    const evidence = (evidenceRows ?? []).map((raw) => {
      const e = raw as unknown as {
        id: string
        entity_type: string
        entity_id: string
        field: string
        confidence: string
        review_state: RecipeDetail['evidence'][number]['reviewState']
        conflict_group: string | null
        field_evidence_translations?: { locale: Locale; note: string }[]
      }
      return {
        id: e.id,
        field: e.field,
        itemId: e.entity_type === 'recipe_item' ? e.entity_id : null,
        confidence: Number(e.confidence),
        reviewState: e.review_state,
        conflictGroup: e.conflict_group,
        startSeconds: null,
        note: resolveText(
          collectTranslations(e.field_evidence_translations, 'note'),
          locale,
          detail.origin_locale,
        ),
      }
    })

    const { data: usedByRows } = await supabase
      .from('recipe_items')
      .select(
        `recipes!recipe_items_recipe_id_fkey (id, slug, origin_locale, recipe_translations (locale, name))`,
      )
      .eq('component_recipe_id', detail.id)

    const usedBy = (usedByRows ?? []).flatMap((raw) => {
      const parent = (
        raw as unknown as {
          recipes?: {
            id: string
            slug: string
            origin_locale: Locale
            recipe_translations?: { locale: Locale; name: string }[]
          } | null
        }
      ).recipes
      if (!parent) return []
      return [
        {
          id: parent.id,
          slug: parent.slug,
          name: resolveText(
            collectTranslations(parent.recipe_translations, 'name'),
            locale,
            parent.origin_locale,
          ),
        },
      ]
    })

    const notes = resolveText(
      collectTranslations(detail.recipe_translations, 'notes'),
      locale,
      detail.origin_locale,
    )

    return {
      ...summary,
      openQuestions:
        evidence.filter(
          (e) => e.reviewState === 'needs_review' || e.reviewState === 'conflict',
        ).length + items.filter((i) => i.amount.kind === 'unknown').length,
      hasConflict: evidence.some((e) => e.reviewState === 'conflict'),
      baseYield: detail.base_yield,
      yieldUnit: unitOrNull(detail.yield_unit),
      baseDiameterMm: detail.base_diameter_mm,
      baseShape: detail.base_shape,
      baseTrayWidthMm: detail.base_tray_width_mm,
      baseTrayHeightMm: detail.base_tray_height_mm,
      baseBallWeightG: detail.base_ball_weight_g,
      notes: notes.value ? notes : null,
      items: items.sort((a, b) => a.sortOrder - b.sortOrder),
      steps: steps.sort((a, b) => a.sortOrder - b.sortOrder),
      evidence,
      usedBy,
    }
  }

  /**
   * Loads the whole recipe graph in two queries. The calculation engine needs
   * every recipe reachable from any root, so paging would only trade one round
   * trip for many; a personal library is a few dozen rows.
   */
  async getGraph(): Promise<RecipeGraph> {
    const supabase = await createClient()

    const [{ data: recipeRows, error: recipeError }, { data: ingredientRows, error: ingredientError }] =
      await Promise.all([
        supabase.from('recipes').select(
          `id, slug, type, status, base_yield, yield_unit, base_diameter_mm, base_shape,
           base_tray_width_mm, base_tray_height_mm, base_ball_weight_g,
           recipe_items (id, ingredient_id, component_recipe_id, amount, amount_max,
                         unit, optional, item_group, sort_order)`,
        ),
        supabase
          .from('ingredients')
          .select('id, slug, measure, base_unit, density_g_per_ml, category_id'),
      ])

    if (recipeError) throw recipeError
    if (ingredientError) throw ingredientError

    const ingredients: DomainIngredient[] = (ingredientRows ?? []).map((raw) => {
      const i = raw as unknown as {
        id: string
        slug: string
        measure: DomainIngredient['measure']
        base_unit: string
        density_g_per_ml: string | null
        category_id: string | null
      }
      return {
        id: i.id,
        slug: i.slug,
        measure: i.measure,
        baseUnit: (unitOrNull(i.base_unit) ?? 'g') as Unit,
        densityGPerMl: i.density_g_per_ml,
        categoryId: i.category_id,
      }
    })

    const recipes: DomainRecipe[] = (recipeRows ?? []).map((raw) => {
      const r = raw as unknown as {
        id: string
        slug: string
        type: DomainRecipe['type']
        status: DomainRecipe['status']
        base_yield: string | null
        yield_unit: string | null
        base_diameter_mm: number | null
        base_shape: DomainRecipe['baseShape']
        base_tray_width_mm: number | null
        base_tray_height_mm: number | null
        base_ball_weight_g: string | null
        recipe_items?: {
          id: string
          ingredient_id: string | null
          component_recipe_id: string | null
          amount: string | null
          amount_max: string | null
          unit: string | null
          optional: boolean
          item_group: string | null
          sort_order: number
        }[]
      }

      return {
        id: r.id,
        slug: r.slug,
        type: r.type,
        status: r.status,
        baseYield: r.base_yield === null ? null : new Decimal(r.base_yield),
        yieldUnit: unitOrNull(r.yield_unit),
        baseDiameterMm: r.base_diameter_mm,
        baseShape: r.base_shape,
        baseTrayWidthMm: r.base_tray_width_mm,
        baseTrayHeightMm: r.base_tray_height_mm,
        baseBallWeightG: r.base_ball_weight_g === null ? null : new Decimal(r.base_ball_weight_g),
        items: (r.recipe_items ?? [])
          .map((item) => ({
            id: item.id,
            ingredientId: item.ingredient_id,
            componentRecipeId: item.component_recipe_id,
            amount: amountFrom(item.amount, item.amount_max, item.unit),
            optional: item.optional,
            group: item.item_group,
            sortOrder: item.sort_order,
            preparationNote: null,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }
    })

    return graphFrom(recipes, ingredients)
  }

  async listIngredients(locale: Locale): Promise<IngredientView[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ingredients')
      .select(
        `id, slug, measure, base_unit, density_g_per_ml, allergens, parent_id, category_id,
         ingredient_translations (locale, name),
         ingredient_aliases (alias),
         ingredient_categories (id, ingredient_category_translations (locale, name))`,
      )
    if (error) throw error

    return (data ?? [])
      .map((raw) => {
        const i = raw as unknown as {
          id: string
          slug: string
          measure: string
          base_unit: string
          density_g_per_ml: string | null
          allergens: string[] | null
          parent_id: string | null
          category_id: string | null
          ingredient_translations?: { locale: Locale; name: string }[]
          ingredient_aliases?: { alias: string }[]
          ingredient_categories?: {
            id: string
            ingredient_category_translations?: { locale: Locale; name: string }[]
          } | null
        }
        return {
          id: i.id,
          slug: i.slug,
          name: resolveText(collectTranslations(i.ingredient_translations, 'name'), locale),
          categoryId: i.category_id ?? '',
          categoryName: i.ingredient_categories
            ? resolveText(
                collectTranslations(i.ingredient_categories.ingredient_category_translations, 'name'),
                locale,
              )
            : { value: '', fallbackFrom: null },
          measure: i.measure,
          baseUnit: (unitOrNull(i.base_unit) ?? 'g') as Unit,
          densityGPerMl: i.density_g_per_ml,
          aliases: (i.ingredient_aliases ?? []).map((a) => a.alias),
          allergens: i.allergens ?? [],
          parentId: i.parent_id,
        }
      })
      .sort((a, b) => a.name.value.localeCompare(b.name.value, locale))
  }

  async listCategories(locale: Locale): Promise<CategoryView[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ingredient_categories')
      .select('id, sort_order, ingredient_category_translations (locale, name)')
      .order('sort_order')
    if (error) throw error

    return (data ?? []).map((raw) => {
      const c = raw as unknown as {
        id: string
        sort_order: number
        ingredient_category_translations?: { locale: Locale; name: string }[]
      }
      return {
        id: c.id,
        name: resolveText(collectTranslations(c.ingredient_category_translations, 'name'), locale),
        sortOrder: c.sort_order,
      }
    })
  }

  async listPackageOptions(): Promise<PackageOption[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ingredient_package_options')
      .select(
        `id, ingredient_id, net_quantity, unit, preferred,
         ingredient_package_option_translations (locale, label)`,
      )
    if (error) throw error

    return (data ?? []).map((raw) => {
      const p = raw as unknown as {
        id: string
        ingredient_id: string
        net_quantity: string
        unit: string
        preferred: boolean
        ingredient_package_option_translations?: { locale: Locale; label: string }[]
      }
      return {
        id: p.id,
        ingredientId: p.ingredient_id,
        netAmount: amountFrom(p.net_quantity, null, p.unit),
        label: p.ingredient_package_option_translations?.[0]?.label ?? null,
        preferred: p.preferred,
      }
    })
  }

  async listSubstitutions(): Promise<Substitution[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ingredient_substitutions')
      .select(
        `id, from_ingredient_id, to_ingredient_id, style_id, quality_grade, approved,
         ingredient_substitution_translations (locale, explanation)`,
      )
    if (error) throw error

    return (data ?? []).map((raw) => {
      const s = raw as unknown as {
        from_ingredient_id: string
        to_ingredient_id: string
        style_id: string | null
        quality_grade: Substitution['qualityGrade']
        approved: boolean
        ingredient_substitution_translations?: { locale: Locale; explanation: string }[]
      }
      return {
        fromIngredientId: s.from_ingredient_id,
        toIngredientId: s.to_ingredient_id,
        styleId: s.style_id,
        qualityGrade: s.quality_grade,
        approved: s.approved,
        explanationKey: s.ingredient_substitution_translations?.[0]?.explanation ?? '',
      }
    })
  }

  async listStyles(locale: Locale) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('styles')
      .select('id, style_translations (locale, name)')
    if (error) throw error
    return (data ?? []).map((raw) => {
      const s = raw as unknown as {
        id: string
        style_translations?: { locale: Locale; name: string }[]
      }
      return { id: s.id, name: resolveText(collectTranslations(s.style_translations, 'name'), locale) }
    })
  }

  async listOvenProfiles(locale: Locale) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('oven_profiles')
      .select('id, oven_profile_translations (locale, name)')
    if (error) throw error
    return (data ?? []).map((raw) => {
      const o = raw as unknown as {
        id: string
        oven_profile_translations?: { locale: Locale; name: string }[]
      }
      return {
        id: o.id,
        name: resolveText(collectTranslations(o.oven_profile_translations, 'name'), locale),
      }
    })
  }

  async getPantry(locale: Locale): Promise<PantryItemView[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('pantry_items')
      .select(
        `id, ingredient_id, quantity, unit, opened, purchased_on, expires_on, location,
         ingredients (ingredient_translations (locale, name)),
         recognized_products (display_name)`,
      )
    if (error) throw error

    return (data ?? []).map((raw) => {
      const p = raw as unknown as {
        id: string
        ingredient_id: string
        quantity: string | null
        unit: string | null
        opened: boolean
        purchased_on: string | null
        expires_on: string | null
        location: StorageLocation
        ingredients?: { ingredient_translations?: { locale: Locale; name: string }[] } | null
        recognized_products?: { display_name: string } | null
      }
      return {
        id: p.id,
        ingredientId: p.ingredient_id,
        ingredientName: p.ingredients
          ? resolveText(collectTranslations(p.ingredients.ingredient_translations, 'name'), locale)
          : { value: p.ingredient_id, fallbackFrom: null },
        amount: amountFrom(p.quantity, null, p.unit),
        location: p.location,
        openedAt: p.opened ? (p.purchased_on ?? null) : null,
        purchasedAt: p.purchased_on,
        expiresAt: p.expires_on,
        recognizedProductName: p.recognized_products?.display_name ?? null,
      }
    })
  }

  async addPantryItem(input: {
    ingredientId: string
    amount: Amount
    location: StorageLocation
    expiresAt?: string | null
  }): Promise<void> {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not signed in')

    const quantity =
      input.amount.kind === 'exact'
        ? input.amount.value.toString()
        : input.amount.kind === 'range'
          ? input.amount.max.toString()
          : null

    const { error } = await supabase.from('pantry_items').insert({
      owner_id: user.id,
      ingredient_id: input.ingredientId,
      quantity,
      unit: input.amount.kind === 'unknown' ? null : input.amount.unit,
      location: input.location,
      expires_on: input.expiresAt ?? null,
      purchased_on: new Date().toISOString().slice(0, 10),
    })
    if (error) throw error
  }

  async removePantryItem(id: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.from('pantry_items').delete().eq('id', id)
    if (error) throw error
  }

  async getPlan(): Promise<MealPlanView> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('meal_plans')
      .select(
        `id, serve_at, notes,
         meal_plan_recipes (id, recipe_id, count, shape, diameter_mm, tray_width_mm,
                            tray_height_mm, ball_weight_g, scale_mode,
                            dough_recipe_id, sauce_recipe_id, sort_order)`,
      )
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (!data) return { id: '', serveAt: null, notes: null, entries: [] }

    const plan = data as unknown as {
      id: string
      serve_at: string | null
      notes: string | null
      meal_plan_recipes?: {
        id: string
        recipe_id: string
        count: number
        shape: 'round' | 'rectangular'
        diameter_mm: number | null
        tray_width_mm: number | null
        tray_height_mm: number | null
        ball_weight_g: string | null
        scale_mode: 'area' | 'portion'
        dough_recipe_id: string | null
        sauce_recipe_id: string | null
        sort_order: number
      }[]
    }

    return {
      id: plan.id,
      serveAt: plan.serve_at,
      notes: plan.notes,
      entries: (plan.meal_plan_recipes ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((entry) => ({
          id: entry.id,
          recipeId: entry.recipe_id,
          count: entry.count,
          shape: entry.shape,
          diameterMm: entry.diameter_mm,
          trayWidthMm: entry.tray_width_mm,
          trayHeightMm: entry.tray_height_mm,
          ballWeightG: entry.ball_weight_g,
          scaleMode: entry.scale_mode,
          doughRecipeId: entry.dough_recipe_id,
          sauceRecipeId: entry.sauce_recipe_id,
        })),
    }
  }

  async savePlan(plan: MealPlanView): Promise<void> {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not signed in')

    let planId = plan.id
    if (!planId) {
      const { data, error } = await supabase
        .from('meal_plans')
        .insert({ owner_id: user.id, serve_at: plan.serveAt, notes: plan.notes })
        .select('id')
        .single()
      if (error) throw error
      planId = (data as { id: string }).id
    } else {
      const { error } = await supabase
        .from('meal_plans')
        .update({ serve_at: plan.serveAt, notes: plan.notes })
        .eq('id', planId)
      if (error) throw error
    }

    // Replace the entry set wholesale: the plan builder always submits the
    // complete list, and diffing rows would add complexity for no gain.
    const { error: deleteError } = await supabase
      .from('meal_plan_recipes')
      .delete()
      .eq('meal_plan_id', planId)
    if (deleteError) throw deleteError

    if (plan.entries.length === 0) return

    const { error: insertError } = await supabase.from('meal_plan_recipes').insert(
      plan.entries.map((entry, index) => ({
        meal_plan_id: planId,
        recipe_id: entry.recipeId,
        count: entry.count,
        shape: entry.shape,
        diameter_mm: entry.diameterMm,
        tray_width_mm: entry.trayWidthMm,
        tray_height_mm: entry.trayHeightMm,
        ball_weight_g: entry.ballWeightG,
        scale_mode: entry.scaleMode,
        dough_recipe_id: entry.doughRecipeId,
        sauce_recipe_id: entry.sauceRecipeId,
        sort_order: index,
      })),
    )
    if (insertError) throw insertError
  }

  async listCookSessions(locale: Locale): Promise<CookSessionView[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cook_sessions')
      .select(
        `id, recipe_id, started_at, finished_at, scale_factor, rating, notes,
         recipes (origin_locale, recipe_translations (locale, name)),
         cook_step_progress (step_id, completed_at)`,
      )
      .order('started_at', { ascending: false })
      .limit(50)
    if (error) throw error

    return (data ?? []).map((raw) => {
      const s = raw as unknown as {
        id: string
        recipe_id: string
        started_at: string
        finished_at: string | null
        scale_factor: string
        rating: number | null
        notes: string | null
        recipes?: {
          origin_locale: Locale
          recipe_translations?: { locale: Locale; name: string }[]
        } | null
        cook_step_progress?: { step_id: string; completed_at: string | null }[]
      }
      return {
        id: s.id,
        recipeId: s.recipe_id,
        recipeName: s.recipes
          ? resolveText(
              collectTranslations(s.recipes.recipe_translations, 'name'),
              locale,
              s.recipes.origin_locale,
            )
          : { value: s.recipe_id, fallbackFrom: null },
        startedAt: s.started_at,
        finishedAt: s.finished_at,
        scaleFactor: s.scale_factor,
        rating: s.rating,
        notes: s.notes,
        completedStepIds: (s.cook_step_progress ?? [])
          .filter((p) => p.completed_at)
          .map((p) => p.step_id),
      }
    })
  }

  async saveCookSession(session: CookSessionView): Promise<void> {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not signed in')

    const { data, error } = await supabase
      .from('cook_sessions')
      .upsert({
        id: session.id || undefined,
        owner_id: user.id,
        recipe_id: session.recipeId,
        scale_factor: session.scaleFactor,
        started_at: session.startedAt,
        finished_at: session.finishedAt,
        rating: session.rating,
        notes: session.notes,
      })
      .select('id')
      .single()
    if (error) throw error

    const sessionId = (data as { id: string }).id
    if (session.completedStepIds.length === 0) return

    const { error: progressError } = await supabase.from('cook_step_progress').upsert(
      session.completedStepIds.map((stepId) => ({
        session_id: sessionId,
        step_id: stepId,
        completed_at: new Date().toISOString(),
      })),
    )
    if (progressError) throw progressError
  }

  async getSettings(): Promise<UserSettingsView> {
    const supabase = await createClient()
    const { data } = await supabase
      .from('profiles')
      .select('preferred_locale, temperature_unit, default_diameter_mm, default_ball_weight_g, default_oven_profile_id')
      .maybeSingle()

    const { data: settings } = await supabase
      .from('user_settings')
      .select('include_experimental')
      .maybeSingle()

    const profile = data as unknown as {
      preferred_locale: Locale
      temperature_unit: 'c' | 'f'
      default_diameter_mm: number
      default_ball_weight_g: string
      default_oven_profile_id: string | null
    } | null

    return {
      locale: profile?.preferred_locale ?? 'ru',
      temperatureUnit: profile?.temperature_unit ?? 'c',
      defaultDiameterMm: profile?.default_diameter_mm ?? 300,
      defaultBallWeightG: Number(profile?.default_ball_weight_g ?? 250),
      defaultOvenProfileId: profile?.default_oven_profile_id ?? null,
      includeExperimental:
        (settings as { include_experimental: boolean } | null)?.include_experimental ?? false,
    }
  }

  async saveSettings(settings: Partial<UserSettingsView>): Promise<void> {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not signed in')

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      ...(settings.locale ? { preferred_locale: settings.locale } : {}),
      ...(settings.temperatureUnit ? { temperature_unit: settings.temperatureUnit } : {}),
      ...(settings.defaultDiameterMm ? { default_diameter_mm: settings.defaultDiameterMm } : {}),
      ...(settings.defaultBallWeightG
        ? { default_ball_weight_g: settings.defaultBallWeightG }
        : {}),
      ...(settings.defaultOvenProfileId !== undefined
        ? { default_oven_profile_id: settings.defaultOvenProfileId }
        : {}),
    })
    if (error) throw error

    if (settings.includeExperimental !== undefined) {
      const { error: settingsError } = await supabase
        .from('user_settings')
        .upsert({ owner_id: user.id, include_experimental: settings.includeExperimental })
      if (settingsError) throw settingsError
    }
  }

  // --- Authoring -----------------------------------------------------------

  /**
   * Writes the whole recipe through the `save_recipe` function, so the eight
   * tables involved land together or not at all. The function is SECURITY
   * INVOKER, so RLS still applies to every statement inside it.
   */
  async saveRecipe(draft: RecipeDraft): Promise<SaveRecipeResult> {
    const issues = validateDraft(draft)
    if (issues.length > 0) {
      throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '))
    }

    const supabase = await createClient()
    const slug = draft.slug?.trim()
    if (!slug) throw new Error('A recipe slug is required')

    // The RPC takes a flattened amount so the SQL does not have to branch on
    // the discriminated union.
    const payload = {
      ...draft,
      slug,
      items: draft.items.map((item, index) => ({
        ...item,
        sortOrder: index,
        amount: flattenAmount(item.amount),
      })),
      steps: draft.steps.map((step, index) => ({ ...step, sortOrder: index })),
    }

    const { data, error } = await supabase.rpc('save_recipe', {
      p_draft: payload,
      p_create_version: draft.createVersion,
    })
    if (error) throw new Error(error.message)

    const result = data as { slug: string; created: boolean; versionCreated: boolean }
    return {
      slug: result.slug,
      created: result.created,
      versionCreated: result.versionCreated,
    }
  }

  async deleteRecipe(slug: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.from('recipes').delete().eq('slug', slug)
    if (error) throw new Error(error.message)
  }

  async getRecipeDraft(slug: string): Promise<RecipeDraft | null> {
    // The detail projection already resolves everything the editor needs; it is
    // reshaped here rather than issuing a second, differently-shaped query.
    const detail = await this.getRecipe('ru', slug)
    if (!detail) return null

    const supabase = await createClient()
    const { data } = await supabase
      .from('recipes')
      .select(
        `slug, origin_locale,
         recipe_translations (locale, name, summary, notes),
         recipe_items (item_key, ingredient_id, component_recipe_id, amount, amount_max,
                       unit, optional, item_group, sort_order,
                       ingredients (slug), component:recipes!recipe_items_component_recipe_id_fkey (slug)),
         recipe_steps (step_key, sort_order, phase, active_minutes, wait_min_minutes,
                       wait_max_minutes, duration_known, temperature_c, timer_seconds,
                       recipe_step_translations (locale, instruction, sensory_cues, troubleshooting),
                       recipe_step_items (recipe_items (item_key)))`,
      )
      .eq('slug', slug)
      .maybeSingle()

    if (!data) return null
    return supabaseRowToDraft(data as never, detail)
  }

  // --- Versions ------------------------------------------------------------

  async listVersions(recipeId: string): Promise<RecipeVersionView[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('recipe_versions')
      .select('id, recipe_id, version_number, created_at, is_primary, note')
      .eq('recipe_id', recipeId)
      .order('version_number', { ascending: false })
    if (error) throw new Error(error.message)

    return (data ?? []).map((raw) => {
      const v = raw as unknown as {
        id: string
        recipe_id: string
        version_number: number
        created_at: string
        is_primary: boolean
        note: string | null
      }
      return {
        id: v.id,
        recipeId: v.recipe_id,
        versionNumber: v.version_number,
        createdAt: v.created_at,
        isPrimary: v.is_primary,
        note: v.note,
      }
    })
  }

  async getVersionDraft(versionId: string): Promise<RecipeDraft | null> {
    const supabase = await createClient()
    const { data } = await supabase
      .from('recipe_versions')
      .select('snapshot')
      .eq('id', versionId)
      .maybeSingle()
    if (!data) return null

    // Snapshots are stored in the database's own row shape; the comparison
    // screen only needs the fields the diff renders.
    return snapshotToDraft((data as { snapshot: unknown }).snapshot)
  }

  async makeVersionPrimary(versionId: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.rpc('make_version_primary', { p_version_id: versionId })
    if (error) throw new Error(error.message)
  }

  // --- Review --------------------------------------------------------------

  async listOpenQuestions(locale: Locale): Promise<OpenQuestionView[]> {
    const recipes = await this.listRecipes(locale)
    const questions: OpenQuestionView[] = []

    // Detail is fetched only for recipes the summary already flagged, so a
    // clean library costs one query rather than one per recipe.
    for (const summary of recipes) {
      if (summary.openQuestions === 0 && !summary.hasConflict) continue
      const detail = await this.getRecipe(locale, summary.slug)
      if (!detail) continue

      for (const item of detail.items) {
        if (item.amount.kind !== 'unknown') continue
        questions.push({
          id: `${detail.slug}:amount:${item.key}`,
          recipeId: detail.id,
          recipeSlug: detail.slug,
          recipeName: detail.name,
          itemId: item.id,
          itemKey: item.key,
          subject: item.name,
          field: 'item.amount',
          reviewState: 'needs_review',
          conflictGroup: null,
          note: null,
          currentAmount: item.amount,
          kind: 'amount',
        })
      }

      for (const evidence of detail.evidence) {
        if (evidence.reviewState !== 'needs_review' && evidence.reviewState !== 'conflict') {
          continue
        }
        const item = detail.items.find((candidate) => candidate.id === evidence.itemId)
        if (item && item.amount.kind === 'unknown') continue

        questions.push({
          id: evidence.id,
          recipeId: detail.id,
          recipeSlug: detail.slug,
          recipeName: detail.name,
          itemId: evidence.itemId,
          itemKey: item?.key ?? null,
          subject: item?.name ?? detail.name,
          field: evidence.field,
          reviewState: evidence.reviewState,
          conflictGroup: evidence.conflictGroup,
          note: evidence.note,
          currentAmount: item?.amount ?? null,
          kind: evidence.field === 'recipe.baseYield' ? 'yield' : item ? 'amount' : 'other',
        })
      }

      if (detail.baseYield === null && (detail.type === 'sauce' || detail.type === 'prep')) {
        questions.push({
          id: `${detail.slug}:yield`,
          recipeId: detail.id,
          recipeSlug: detail.slug,
          recipeName: detail.name,
          itemId: null,
          itemKey: null,
          subject: detail.name,
          field: 'recipe.baseYield',
          reviewState: 'needs_review',
          conflictGroup: null,
          note: detail.notes,
          currentAmount: null,
          kind: 'yield',
        })
      }
    }

    return questions
  }

  // --- Ingredients ---------------------------------------------------------

  async createIngredient(input: {
    names: Record<Locale, string>
    categorySlug: string
    measure: string
    baseUnit: Unit
    aliases?: string[]
  }): Promise<string> {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not signed in')

    const slug = slugifyForDb(input.names.en || input.names.ru || input.names.fr)

    const { data: category } = await supabase
      .from('ingredient_categories')
      .select('id')
      .eq('slug', input.categorySlug)
      .maybeSingle()

    const { data, error } = await supabase
      .from('ingredients')
      .insert({
        owner_id: user.id,
        slug,
        category_id: (category as { id: string } | null)?.id ?? null,
        measure: input.measure,
        base_unit: input.baseUnit,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)

    const ingredientId = (data as { id: string }).id

    const { error: translationError } = await supabase.from('ingredient_translations').insert(
      (['ru', 'en', 'fr'] as const).map((locale) => ({
        ingredient_id: ingredientId,
        locale,
        name: input.names[locale] || input.names.en || slug,
      })),
    )
    if (translationError) throw new Error(translationError.message)

    if (input.aliases?.length) {
      await supabase.from('ingredient_aliases').insert(
        input.aliases.map((alias) => ({ ingredient_id: ingredientId, locale: null, alias })),
      )
    }

    return slug
  }

  // --- Imports -------------------------------------------------------------

  async hasApprovedImport(idempotencyKey: string): Promise<boolean> {
    const supabase = await createClient()
    const { data } = await supabase
      .from('approved_imports')
      .select('idempotency_key')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    return Boolean(data)
  }

  async markImportApproved(idempotencyKey: string): Promise<void> {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not signed in')

    // The primary key makes a concurrent double submit fail rather than
    // silently producing a second recipe.
    const { error } = await supabase
      .from('approved_imports')
      .insert({ owner_id: user.id, idempotency_key: idempotencyKey })
    if (error && !error.message.includes('duplicate')) throw new Error(error.message)
  }
}

/** Flattens an amount into the columns the RPC expects. */
function flattenAmount(amount: RecipeDraft['items'][number]['amount']) {
  switch (amount.kind) {
    case 'exact':
      return { kind: 'exact', value: amount.value.replace(',', '.'), max: null, unit: amount.unit }
    case 'range':
      return {
        kind: 'range',
        value: amount.min.replace(',', '.'),
        max: amount.max.replace(',', '.'),
        unit: amount.unit,
      }
    case 'qualitative':
      return { kind: 'qualitative', value: null, max: null, unit: amount.unit }
    case 'unknown':
      return { kind: 'unknown', value: null, max: null, unit: null }
  }
}

function slugifyForDb(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || `ingredient-${Date.now()}`
  )
}

/** Reconstructs an editor draft from the database's own row shape. */
function supabaseRowToDraft(
  row: Record<string, never>,
  detail: import('../types').RecipeDetail,
): RecipeDraft {
  const r = row as unknown as {
    origin_locale: Locale
    recipe_translations?: {
      locale: Locale
      name: string
      summary: string | null
      notes: string | null
    }[]
    recipe_items?: {
      item_key: string | null
      amount: string | null
      amount_max: string | null
      unit: string | null
      optional: boolean
      item_group: string | null
      sort_order: number
      ingredients?: { slug: string } | null
      component?: { slug: string } | null
    }[]
    recipe_steps?: {
      step_key: string | null
      sort_order: number
      phase: RecipeDraft['steps'][number]['phase']
      active_minutes: number
      wait_min_minutes: number
      wait_max_minutes: number
      duration_known: boolean
      temperature_c: string | null
      timer_seconds: number | null
      recipe_step_translations?: {
        locale: Locale
        instruction: string
        sensory_cues: string | null
        troubleshooting: string | null
      }[]
      recipe_step_items?: { recipe_items?: { item_key: string | null } | null }[]
    }[]
  }

  const byLocale = <T extends string>(
    rows: { locale: Locale }[] | undefined,
    field: string,
  ): Record<Locale, T | string> => {
    const out = { ru: '', en: '', fr: '' } as Record<Locale, string>
    for (const entry of rows ?? []) {
      const value = (entry as unknown as Record<string, unknown>)[field]
      if (typeof value === 'string') out[entry.locale] = value
    }
    return out
  }

  return {
    slug: detail.slug,
    type: detail.type,
    status: detail.status === 'archived' ? 'draft' : detail.status,
    authenticity: detail.authenticity,
    styleSlug: detail.styleId,
    ovenProfileSlug: detail.ovenProfileId,
    originLocale: r.origin_locale,
    baseYield: detail.baseYield,
    yieldUnit: detail.yieldUnit,
    baseDiameterMm: detail.baseDiameterMm,
    baseShape: detail.baseShape,
    baseTrayWidthMm: detail.baseTrayWidthMm,
    baseTrayHeightMm: detail.baseTrayHeightMm,
    baseBallWeightG: detail.baseBallWeightG,
    activeMinutes: detail.activeMinutes,
    passiveMinutes: detail.passiveMinutes,
    difficulty: detail.difficulty,
    tags: detail.tags,
    names: byLocale(r.recipe_translations, 'name') as Record<Locale, string>,
    summaries: byLocale(r.recipe_translations, 'summary') as Record<Locale, string>,
    notes: byLocale(r.recipe_translations, 'notes') as Record<Locale, string>,
    items: (r.recipe_items ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        key: item.item_key ?? `item-${item.sort_order}`,
        ingredientSlug: item.ingredients?.slug ?? null,
        componentSlug: item.component?.slug ?? null,
        amount: rowToDraftAmount(item.amount, item.amount_max, item.unit),
        optional: item.optional,
        group: item.item_group,
        notes: { ru: '', en: '', fr: '' },
      })),
    steps: (r.recipe_steps ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((step) => ({
        key: step.step_key ?? `step-${step.sort_order}`,
        phase: step.phase,
        activeMinutes: step.active_minutes,
        waitMinMinutes: step.wait_min_minutes,
        waitMaxMinutes: step.wait_max_minutes,
        durationKnown: step.duration_known,
        temperatureC: step.temperature_c === null ? null : Number(step.temperature_c),
        timerSeconds: step.timer_seconds,
        itemKeys: (step.recipe_step_items ?? []).flatMap((link) =>
          link.recipe_items?.item_key ? [link.recipe_items.item_key] : [],
        ),
        instructions: byLocale(step.recipe_step_translations, 'instruction') as Record<Locale, string>,
        cues: byLocale(step.recipe_step_translations, 'sensory_cues') as Record<Locale, string>,
        troubleshooting: byLocale(
          step.recipe_step_translations,
          'troubleshooting',
        ) as Record<Locale, string>,
      })),
    source: detail.source,
    evidence: detail.evidence.map((entry) => ({
      field: entry.field,
      itemKey: detail.items.find((i) => i.id === entry.itemId)?.key ?? null,
      confidence: entry.confidence,
      reviewState: entry.reviewState,
      conflictGroup: entry.conflictGroup,
      startSeconds: entry.startSeconds,
      notes: { ru: entry.note.value, en: entry.note.value, fr: entry.note.value },
    })),
    media: [],
    createVersion: false,
    versionNote: null,
  }
}

function rowToDraftAmount(
  amount: string | null,
  amountMax: string | null,
  unit: string | null,
): RecipeDraft['items'][number]['amount'] {
  if (!unit) return { kind: 'unknown' }
  if (amount === null) return { kind: 'qualitative', unit }
  if (amountMax !== null) return { kind: 'range', min: amount, max: amountMax, unit }
  return { kind: 'exact', value: amount, unit }
}

/**
 * Turns a stored version snapshot into a draft.
 *
 * Snapshots hold raw database rows, so this reshapes the parts the comparison
 * screen renders. Anything it cannot recover comes back empty rather than
 * invented.
 */
function snapshotToDraft(snapshot: unknown): RecipeDraft | null {
  const snap = snapshot as {
    recipe?: Record<string, unknown>
    translations?: { locale: Locale; name?: string; summary?: string; notes?: string }[]
    items?: {
      item_key?: string | null
      amount?: string | null
      amount_max?: string | null
      unit?: string | null
      optional?: boolean
      item_group?: string | null
      sort_order?: number
    }[]
    steps?: Record<string, unknown>[]
    step_translations?: { step_id: string; locale: Locale; instruction?: string }[]
  } | null

  if (!snap?.recipe) return null
  const recipe = snap.recipe

  const localized = (field: string): Record<Locale, string> => {
    const out: Record<Locale, string> = { ru: '', en: '', fr: '' }
    for (const entry of snap.translations ?? []) {
      const value = (entry as unknown as Record<string, unknown>)[field]
      if (typeof value === 'string') out[entry.locale] = value
    }
    return out
  }

  const text = (key: string) => {
    const value = recipe[key]
    return value === null || value === undefined ? null : String(value)
  }
  const int = (key: string) => {
    const value = recipe[key]
    return value === null || value === undefined ? null : Number(value)
  }

  return {
    slug: text('slug'),
    type: (recipe.type as RecipeDraft['type']) ?? 'pizza',
    status: recipe.status === 'archived' ? 'draft' : ((recipe.status as RecipeDraft['status']) ?? 'draft'),
    authenticity: (recipe.authenticity as RecipeDraft['authenticity']) ?? 'user_verified',
    styleSlug: null,
    ovenProfileSlug: null,
    originLocale: (recipe.origin_locale as Locale) ?? 'ru',
    baseYield: text('base_yield'),
    yieldUnit: (text('yield_unit') as RecipeDraft['yieldUnit']) ?? null,
    baseDiameterMm: int('base_diameter_mm'),
    baseShape: (text('base_shape') as RecipeDraft['baseShape']) ?? null,
    baseTrayWidthMm: int('base_tray_width_mm'),
    baseTrayHeightMm: int('base_tray_height_mm'),
    baseBallWeightG: text('base_ball_weight_g'),
    activeMinutes: int('active_minutes'),
    passiveMinutes: int('passive_minutes'),
    difficulty: int('difficulty') as RecipeDraft['difficulty'],
    tags: Array.isArray(recipe.tags) ? (recipe.tags as string[]) : [],
    names: localized('name'),
    summaries: localized('summary'),
    notes: localized('notes'),
    items: (snap.items ?? [])
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((item, index) => ({
        key: item.item_key ?? `item-${index}`,
        // Snapshots hold ids rather than slugs; the diff compares amounts, and
        // showing an id as an ingredient name would be worse than showing none.
        ingredientSlug: null,
        componentSlug: null,
        amount: rowToDraftAmount(item.amount ?? null, item.amount_max ?? null, item.unit ?? null),
        optional: item.optional ?? false,
        group: item.item_group ?? null,
        notes: { ru: '', en: '', fr: '' },
      })),
    steps: (snap.steps ?? []).map((step, index) => ({
      key: (step.step_key as string) ?? `step-${index}`,
      phase: (step.phase as RecipeDraft['steps'][number]['phase']) ?? 'other',
      activeMinutes: Number(step.active_minutes ?? 0),
      waitMinMinutes: Number(step.wait_min_minutes ?? 0),
      waitMaxMinutes: Number(step.wait_max_minutes ?? 0),
      durationKnown: Boolean(step.duration_known ?? true),
      temperatureC: step.temperature_c === null ? null : Number(step.temperature_c),
      timerSeconds: step.timer_seconds === null ? null : Number(step.timer_seconds),
      itemKeys: [],
      instructions: { ru: '', en: '', fr: '' },
      cues: { ru: '', en: '', fr: '' },
      troubleshooting: { ru: '', en: '', fr: '' },
    })),
    source: null,
    evidence: [],
    media: [],
    createVersion: false,
    versionNote: null,
  }
}
