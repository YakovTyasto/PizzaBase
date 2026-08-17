import 'server-only'
import { Decimal } from 'decimal.js'
import {
  type Amount,
  type Locale,
  type PackageOption,
  type RecipeGraph,
  type StorageLocation,
  type Substitution,
  type Unit,
  buildAliasIndex,
  searchKey,
} from '@/domain'
import { seedCatalog } from '@/lib/seed'
import type { SeedIngredient, SeedRecipe } from '@/lib/seed/types'
import { seedAmountToDomain, toDomainGraph } from '@/lib/seed/to-domain'
import { optionalText, resolveText } from '../localize'
import type {
  CategoryView,
  CookSessionView,
  IngredientView,
  MealPlanView,
  PantryItemView,
  RecipeDetail,
  RecipeFilter,
  RecipeItemView,
  RecipeStepView,
  RecipeSummary,
  Repository,
  UserSettingsView,
} from '../types'
import { readDemoState, toPlanView, toSettingsView, updateDemoState } from './store'

/**
 * Serves the bundled seed catalog. This is what makes a first run work with no
 * Supabase project, no account and no API keys.
 *
 * Reads come from the seed; the handful of things a user changes (pantry, plan,
 * cook sessions, settings) live in the demo cookie.
 */

const ingredientBySlug = new Map(seedCatalog.ingredients.map((i) => [i.slug, i]))
const recipeBySlug = new Map(seedCatalog.recipes.map((r) => [r.slug, r]))
const categoryBySlug = new Map(seedCatalog.categories.map((c) => [c.slug, c]))
const styleBySlug = new Map(seedCatalog.styles.map((s) => [s.slug, s]))
const ovenBySlug = new Map(seedCatalog.ovenProfiles.map((o) => [o.slug, o]))

const aliasIndex = buildAliasIndex(
  seedCatalog.ingredients.flatMap((ingredient) => [
    ...Object.values(ingredient.names).map((alias) => ({
      ingredientId: ingredient.slug,
      locale: null,
      alias,
    })),
    ...Object.entries(ingredient.aliases ?? {}).flatMap(([locale, list]) =>
      (list ?? []).map((alias) => ({
        ingredientId: ingredient.slug,
        locale: locale as Locale,
        alias,
      })),
    ),
  ]),
)

function ingredientAliases(ingredient: SeedIngredient): string[] {
  return [
    ...Object.values(ingredient.names),
    ...Object.values(ingredient.aliases ?? {}).flat(),
  ].filter((value): value is string => Boolean(value))
}

function itemDisplayName(
  item: SeedRecipe['items'][number],
  locale: Locale,
): ReturnType<typeof resolveText> {
  if (item.ingredientSlug) {
    const ingredient = ingredientBySlug.get(item.ingredientSlug)
    return ingredient
      ? resolveText(ingredient.names, locale)
      : { value: item.ingredientSlug, fallbackFrom: null }
  }
  if (item.componentSlug) {
    const component = recipeBySlug.get(item.componentSlug)
    return component
      ? resolveText(component.names, locale, component.originLocale)
      : { value: item.componentSlug, fallbackFrom: null }
  }
  return { value: '', fallbackFrom: null }
}

function openQuestionsOf(recipe: SeedRecipe): number {
  const flagged = (recipe.evidence ?? []).filter(
    (e) => e.reviewState === 'needs_review' || e.reviewState === 'conflict',
  ).length
  const unknownAmounts = recipe.items.filter((i) => i.amount.kind === 'unknown').length
  return flagged + unknownAmounts
}

function toSummary(recipe: SeedRecipe, locale: Locale): RecipeSummary {
  const style = recipe.styleSlug ? styleBySlug.get(recipe.styleSlug) : null
  const oven = recipe.ovenProfileSlug ? ovenBySlug.get(recipe.ovenProfileSlug) : null

  return {
    id: recipe.slug,
    slug: recipe.slug,
    type: recipe.type,
    status: recipe.status,
    authenticity: recipe.authenticity,
    styleId: recipe.styleSlug ?? null,
    styleName: style ? resolveText(style.names, locale) : null,
    ovenProfileId: recipe.ovenProfileSlug ?? null,
    ovenName: oven ? resolveText(oven.names, locale) : null,
    name: resolveText(recipe.names, locale, recipe.originLocale),
    summary: optionalText(recipe.summaries, locale, recipe.originLocale),
    activeMinutes: recipe.activeMinutes ?? null,
    passiveMinutes: recipe.passiveMinutes ?? null,
    difficulty: recipe.difficulty ?? null,
    tags: recipe.tags ?? [],
    source: recipe.source
      ? {
          sourceType: recipe.source.sourceType,
          author: recipe.source.author ?? null,
          title: recipe.source.title ?? null,
          url: recipe.source.url ?? null,
          credibilityTier: recipe.source.credibilityTier,
          attribution: recipe.source.attribution ?? null,
        }
      : null,
    openQuestions: openQuestionsOf(recipe),
    hasConflict: (recipe.evidence ?? []).some((e) => e.reviewState === 'conflict'),
  }
}

function matchesFilter(recipe: SeedRecipe, locale: Locale, filter: RecipeFilter): boolean {
  if (filter.type && recipe.type !== filter.type) return false
  if (filter.status && recipe.status !== filter.status) return false
  if (filter.authenticity && recipe.authenticity !== filter.authenticity) return false
  if (filter.styleId && recipe.styleSlug !== filter.styleId) return false
  if (filter.ovenProfileId && recipe.ovenProfileSlug !== filter.ovenProfileId) return false

  const query = filter.query?.trim()
  if (!query) return true

  const key = searchKey(query)
  // Search spans every locale's name and summary, the tags, the author, and
  // the ingredient aliases -- so a Russian query finds an English recipe.
  const haystack = [
    ...Object.values(recipe.names),
    ...Object.values(recipe.summaries ?? {}),
    ...(recipe.tags ?? []),
    recipe.source?.author ?? '',
    recipe.source?.title ?? '',
    recipe.styleSlug ?? '',
  ]
    .filter(Boolean)
    .map((value) => searchKey(String(value)))

  if (haystack.some((value) => value.includes(key))) return true

  const matchedIngredients = new Set(aliasIndex.lookup(query))
  if (matchedIngredients.size === 0) return false
  return recipe.items.some((i) => i.ingredientSlug && matchedIngredients.has(i.ingredientSlug))
}

function demoPantryToView(
  items: Awaited<ReturnType<typeof readDemoState>>['pantry'],
  locale: Locale,
): PantryItemView[] {
  return items.map((item) => {
    const ingredient = ingredientBySlug.get(item.ingredientId)
    return {
      id: item.id,
      ingredientId: item.ingredientId,
      ingredientName: ingredient
        ? resolveText(ingredient.names, locale)
        : { value: item.ingredientId, fallbackFrom: null },
      amount: seedAmountToDomain(item.amount as never),
      location: item.location,
      openedAt: item.openedAt,
      purchasedAt: item.purchasedAt,
      expiresAt: item.expiresAt,
      recognizedProductName: null,
    }
  })
}

function amountToSeed(amount: Amount) {
  switch (amount.kind) {
    case 'exact':
      return { kind: 'exact' as const, value: amount.value.toString(), unit: amount.unit }
    case 'range':
      return {
        kind: 'range' as const,
        min: amount.min.toString(),
        max: amount.max.toString(),
        unit: amount.unit,
      }
    case 'qualitative':
      return { kind: 'qualitative' as const, unit: amount.unit }
    case 'unknown':
      return { kind: 'unknown' as const }
  }
}

export class DemoRepository implements Repository {
  readonly kind = 'demo' as const

  async listRecipes(locale: Locale, filter: RecipeFilter = {}): Promise<RecipeSummary[]> {
    return seedCatalog.recipes
      .filter((recipe) => recipe.status !== 'archived' && matchesFilter(recipe, locale, filter))
      .map((recipe) => toSummary(recipe, locale))
      .sort((a, b) => a.name.value.localeCompare(b.name.value, locale))
  }

  async getRecipe(locale: Locale, slug: string): Promise<RecipeDetail | null> {
    const recipe = recipeBySlug.get(slug)
    if (!recipe) return null

    const items: RecipeItemView[] = recipe.items.map((item, index) => ({
      id: `${recipe.slug}:${item.key}`,
      key: item.key,
      ingredientId: item.ingredientSlug ?? null,
      componentRecipeId: item.componentSlug ?? null,
      name: itemDisplayName(item, locale),
      amount: seedAmountToDomain(item.amount),
      optional: item.optional ?? false,
      group: item.group ?? null,
      note: optionalText(item.notes, locale, recipe.originLocale),
      sortOrder: index,
    }))

    const steps: RecipeStepView[] = recipe.steps.map((step, index) => ({
      id: `${recipe.slug}:step:${step.key}`,
      key: step.key,
      phase: step.phase,
      sortOrder: index,
      activeMinutes: step.activeMinutes ?? 0,
      waitMinMinutes: step.waitMinMinutes ?? 0,
      waitMaxMinutes: step.waitMaxMinutes ?? step.waitMinMinutes ?? 0,
      durationKnown: step.durationKnown ?? true,
      temperatureC: step.temperatureC ?? null,
      timerSeconds: step.timerSeconds ?? null,
      itemIds: (step.itemKeys ?? []).map((key) => `${recipe.slug}:${key}`),
      instruction: resolveText(step.instructions, locale, recipe.originLocale),
      cues: optionalText(step.cues, locale, recipe.originLocale),
      troubleshooting: optionalText(step.troubleshooting, locale, recipe.originLocale),
    }))

    const usedBy = seedCatalog.recipes
      .filter((candidate) => candidate.items.some((i) => i.componentSlug === recipe.slug))
      .map((candidate) => ({
        id: candidate.slug,
        slug: candidate.slug,
        name: resolveText(candidate.names, locale, candidate.originLocale),
      }))

    return {
      ...toSummary(recipe, locale),
      baseYield: recipe.baseYield ?? null,
      yieldUnit: recipe.yieldUnit ?? null,
      baseDiameterMm: recipe.baseDiameterMm ?? null,
      baseShape: recipe.baseShape ?? null,
      baseTrayWidthMm: recipe.baseTrayWidthMm ?? null,
      baseTrayHeightMm: recipe.baseTrayHeightMm ?? null,
      baseBallWeightG: recipe.baseBallWeightG ?? null,
      notes: optionalText(recipe.notes, locale, recipe.originLocale),
      items,
      steps,
      evidence: (recipe.evidence ?? []).map((evidence, index) => ({
        id: `${recipe.slug}:evidence:${index}`,
        field: evidence.field,
        itemId: evidence.itemKey ? `${recipe.slug}:${evidence.itemKey}` : null,
        confidence: evidence.confidence,
        reviewState: evidence.reviewState,
        conflictGroup: evidence.conflictGroup ?? null,
        startSeconds: evidence.startSeconds ?? null,
        note: resolveText(evidence.notes, locale, recipe.originLocale),
      })),
      usedBy,
    }
  }

  async getGraph(): Promise<RecipeGraph> {
    return toDomainGraph().graph
  }

  async listIngredients(locale: Locale): Promise<IngredientView[]> {
    return seedCatalog.ingredients
      .map((ingredient) => {
        const category = categoryBySlug.get(ingredient.categorySlug)
        return {
          id: ingredient.slug,
          slug: ingredient.slug,
          name: resolveText(ingredient.names, locale),
          categoryId: ingredient.categorySlug,
          categoryName: category
            ? resolveText(category.names, locale)
            : { value: ingredient.categorySlug, fallbackFrom: null },
          measure: ingredient.measure,
          baseUnit: ingredient.baseUnit,
          densityGPerMl: ingredient.densityGPerMl ?? null,
          aliases: ingredientAliases(ingredient),
          allergens: ingredient.allergens ?? [],
          parentId: ingredient.parentSlug ?? null,
        }
      })
      .sort((a, b) => a.name.value.localeCompare(b.name.value, locale))
  }

  async listCategories(locale: Locale): Promise<CategoryView[]> {
    return seedCatalog.categories
      .map((category) => ({
        id: category.slug,
        name: resolveText(category.names, locale),
        sortOrder: category.sortOrder,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async listPackageOptions(): Promise<PackageOption[]> {
    return seedCatalog.packageOptions.map((option) => ({
      id: option.slug,
      ingredientId: option.ingredientSlug,
      netAmount: seedAmountToDomain(option.netAmount),
      label: option.labels.en,
      preferred: option.preferred ?? false,
    }))
  }

  async listSubstitutions(): Promise<Substitution[]> {
    return seedCatalog.substitutions.map((substitution) => ({
      fromIngredientId: substitution.fromSlug,
      toIngredientId: substitution.toSlug,
      styleId: substitution.styleSlug ?? null,
      qualityGrade: substitution.qualityGrade,
      approved: substitution.approved,
      explanationKey: substitution.explanations.en,
    }))
  }

  async listStyles(locale: Locale) {
    return seedCatalog.styles.map((style) => ({
      id: style.slug,
      name: resolveText(style.names, locale),
    }))
  }

  async listOvenProfiles(locale: Locale) {
    return seedCatalog.ovenProfiles.map((oven) => ({
      id: oven.slug,
      name: resolveText(oven.names, locale),
    }))
  }

  async getPantry(locale: Locale): Promise<PantryItemView[]> {
    const state = await readDemoState()
    return demoPantryToView(state.pantry, locale)
  }

  async addPantryItem(input: {
    ingredientId: string
    amount: Amount
    location: StorageLocation
    expiresAt?: string | null
  }): Promise<void> {
    await updateDemoState((state) => ({
      ...state,
      pantry: [
        ...state.pantry,
        {
          id: `pantry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ingredientId: input.ingredientId,
          amount: amountToSeed(input.amount),
          location: input.location,
          openedAt: null,
          purchasedAt: new Date().toISOString(),
          expiresAt: input.expiresAt ?? null,
        },
      ],
    }))
  }

  async removePantryItem(id: string): Promise<void> {
    await updateDemoState((state) => ({
      ...state,
      pantry: state.pantry.filter((item) => item.id !== id),
    }))
  }

  async getPlan(): Promise<MealPlanView> {
    return toPlanView(await readDemoState())
  }

  async savePlan(plan: MealPlanView): Promise<void> {
    await updateDemoState((state) => ({
      ...state,
      plan: {
        id: plan.id || 'demo-plan',
        serveAt: plan.serveAt,
        notes: plan.notes,
        entries: plan.entries,
      },
    }))
  }

  async listCookSessions(locale: Locale): Promise<CookSessionView[]> {
    const state = await readDemoState()
    return state.sessions
      .map((session) => {
        const recipe = recipeBySlug.get(session.recipeId)
        return {
          id: session.id,
          recipeId: session.recipeId,
          recipeName: recipe
            ? resolveText(recipe.names, locale, recipe.originLocale)
            : { value: session.recipeId, fallbackFrom: null },
          startedAt: session.startedAt,
          finishedAt: session.finishedAt,
          scaleFactor: session.scaleFactor,
          rating: session.rating,
          notes: session.notes,
          completedStepIds: session.completedStepIds,
        }
      })
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  async saveCookSession(session: CookSessionView): Promise<void> {
    await updateDemoState((state) => {
      const rest = state.sessions.filter((s) => s.id !== session.id)
      return {
        ...state,
        // Cap history so the cookie cannot grow without bound.
        sessions: [
          {
            id: session.id,
            recipeId: session.recipeId,
            startedAt: session.startedAt,
            finishedAt: session.finishedAt,
            scaleFactor: session.scaleFactor,
            rating: session.rating,
            notes: session.notes?.slice(0, 280) ?? null,
            completedStepIds: session.completedStepIds,
          },
          ...rest,
        ].slice(0, 10),
      }
    })
  }

  async getSettings(): Promise<UserSettingsView> {
    const state = await readDemoState()
    return toSettingsView(state, 'ru')
  }

  async saveSettings(settings: Partial<UserSettingsView>): Promise<void> {
    await updateDemoState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        temperatureUnit: settings.temperatureUnit ?? state.settings.temperatureUnit,
        defaultDiameterMm: settings.defaultDiameterMm ?? state.settings.defaultDiameterMm,
        defaultBallWeightG: settings.defaultBallWeightG ?? state.settings.defaultBallWeightG,
        defaultOvenProfileId:
          settings.defaultOvenProfileId === undefined
            ? state.settings.defaultOvenProfileId
            : settings.defaultOvenProfileId,
        includeExperimental: settings.includeExperimental ?? state.settings.includeExperimental,
      },
    }))
  }
}

/** Yield of a component once a package size is chosen (see the tomato sauce). */
export function yieldFromPackage(
  packageNet: Amount,
  packageCount: number,
): { value: Decimal; unit: Unit } | null {
  if (packageNet.kind !== 'exact') return null
  return { value: packageNet.value.times(packageCount), unit: packageNet.unit }
}
