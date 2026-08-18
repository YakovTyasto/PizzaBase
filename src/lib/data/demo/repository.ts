import 'server-only'
import { coverOf, mediaViews } from '../media-view'
import { randomUUID } from 'node:crypto'
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
import { seedAmountToDomain } from '@/lib/seed/to-domain'
import type { SeedIngredient, SeedRecipe } from '@/lib/seed/types'
import { draftToStored, findComponentCycle, storedToDraft } from '../draft-convert'
import { optionalText, resolveText } from '../localize'
import { type RecipeDraft, uniqueSlug, validateDraft } from '../recipe-draft'
import type {
  CategoryView,
  CookSessionView,
  IngredientView,
  MealPlanView,
  OpenQuestionView,
  PantryItemView,
  RecipeDetail,
  RecipeFilter,
  RecipeItemView,
  RecipeStepView,
  RecipeSummary,
  RecipeVersionView,
  Repository,
  ExperimentView,
  SaveRecipeResult,
  UserSettingsView,
} from '../types'
import { buildGraph, effectiveIngredients, effectiveRecipes, findRecipe } from './catalog'
import {
  type DemoOverlay,
  EMPTY_OVERLAY,
  readOverlay,
  resetOverlay,
  updateOverlay,
} from './overlay'
import { ensureSessionId, readSessionId } from './session'

/**
 * Demo-mode repository.
 *
 * Reads merge the bundled seed with the owner's overlay; writes go to the
 * overlay only. This is what makes a first run work with no Supabase project
 * while still being a genuinely usable app: recipes created here survive a
 * reload and a browser restart.
 *
 * Reads never mint a session (Next.js forbids setting cookies while
 * rendering), so a browser with no session simply sees the untouched seed.
 */

const categoryBySlug = new Map(seedCatalog.categories.map((c) => [c.slug, c]))
const styleBySlug = new Map(seedCatalog.styles.map((s) => [s.slug, s]))
const ovenBySlug = new Map(seedCatalog.ovenProfiles.map((o) => [o.slug, o]))

export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly code: 'not_found' | 'validation' | 'cycle' | 'conflict',
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'RepositoryError'
  }
}

function ingredientAliases(ingredient: SeedIngredient): string[] {
  return [
    ...Object.values(ingredient.names),
    ...Object.values(ingredient.aliases ?? {}).flat(),
  ].filter((value): value is string => Boolean(value))
}

function openQuestionsOf(recipe: SeedRecipe): number {
  const flagged = (recipe.evidence ?? []).filter(
    (e) => e.reviewState === 'needs_review' || e.reviewState === 'conflict',
  ).length
  const unknownAmounts = recipe.items.filter((i) => i.amount.kind === 'unknown').length
  return flagged + unknownAmounts
}

export class DemoRepository implements Repository {
  readonly kind = 'demo' as const

  /** Reads are session-optional: without one the seed is served untouched. */
  private async overlay(): Promise<DemoOverlay> {
    const sessionId = await readSessionId()
    return sessionId ? readOverlay(sessionId) : EMPTY_OVERLAY
  }

  /** Writes always need a session, minting one on first use. */
  private async mutate(
    apply: (overlay: DemoOverlay) => DemoOverlay,
  ): Promise<DemoOverlay> {
    const sessionId = await ensureSessionId()
    return updateOverlay(sessionId, apply)
  }

  private ingredientMap(overlay: DemoOverlay): Map<string, SeedIngredient> {
    return new Map(effectiveIngredients(overlay).map((i) => [i.slug, i]))
  }

  private toSummary(
    recipe: SeedRecipe,
    locale: Locale,
  ): RecipeSummary {
    const style = recipe.styleSlug ? styleBySlug.get(recipe.styleSlug) : null
    const oven = recipe.ovenProfileSlug ? ovenBySlug.get(recipe.ovenProfileSlug) : null

    return {
      id: recipe.slug,
      slug: recipe.slug,
      type: recipe.type,
      status: recipe.status,
      authenticity: recipe.authenticity,
      cover: coverOf(recipe, locale),
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

  async listRecipes(locale: Locale, filter: RecipeFilter = {}): Promise<RecipeSummary[]> {
    const overlay = await this.overlay()
    const recipes = effectiveRecipes(overlay)
    const ingredients = effectiveIngredients(overlay)

    const aliasIndex = buildAliasIndex(
      ingredients.flatMap((ingredient) => [
        ...Object.values(ingredient.names).map((alias) => ({
          ingredientId: ingredient.slug,
          locale: null,
          alias,
        })),
        ...Object.entries(ingredient.aliases ?? {}).flatMap(([aliasLocale, list]) =>
          (list ?? []).map((alias) => ({
            ingredientId: ingredient.slug,
            locale: aliasLocale as Locale,
            alias,
          })),
        ),
      ]),
    )

    const matches = (recipe: SeedRecipe): boolean => {
      if (filter.type && recipe.type !== filter.type) return false
      if (filter.status && recipe.status !== filter.status) return false
      if (filter.authenticity && recipe.authenticity !== filter.authenticity) return false
      if (filter.styleId && recipe.styleSlug !== filter.styleId) return false
      if (filter.ovenProfileId && recipe.ovenProfileSlug !== filter.ovenProfileId) return false

      const query = filter.query?.trim()
      if (!query) return true
      const key = searchKey(query)

      // Search spans every locale plus ingredient aliases, so a Russian query
      // finds an English-authored recipe through a French alias.
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

      const matched = new Set(aliasIndex.lookup(query))
      if (matched.size === 0) return false
      return recipe.items.some((i) => i.ingredientSlug && matched.has(i.ingredientSlug))
    }

    return recipes
      .filter((recipe) => recipe.status !== 'archived' && matches(recipe))
      .map((recipe) => this.toSummary(recipe, locale))
      .sort((a, b) => a.name.value.localeCompare(b.name.value, locale))
  }

  async getRecipe(locale: Locale, slug: string): Promise<RecipeDetail | null> {
    const overlay = await this.overlay()
    const recipe = findRecipe(overlay, slug)
    if (!recipe) return null

    const ingredients = this.ingredientMap(overlay)
    const allRecipes = effectiveRecipes(overlay)
    const recipeBySlug = new Map(allRecipes.map((r) => [r.slug, r]))

    const itemName = (item: SeedRecipe['items'][number]) => {
      if (item.ingredientSlug) {
        const ingredient = ingredients.get(item.ingredientSlug)
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

    const items: RecipeItemView[] = recipe.items.map((item, index) => ({
      id: `${recipe.slug}:${item.key}`,
      key: item.key,
      ingredientId: item.ingredientSlug ?? null,
      componentRecipeId: item.componentSlug ?? null,
      name: itemName(item),
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

    const usedBy = allRecipes
      .filter((candidate) => candidate.items.some((i) => i.componentSlug === recipe.slug))
      .map((candidate) => ({
        id: candidate.slug,
        slug: candidate.slug,
        name: resolveText(candidate.names, locale, candidate.originLocale),
      }))

    return {
      ...this.toSummary(recipe, locale),
      media: mediaViews(recipe.media ?? [], locale),
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
    return buildGraph(await this.overlay())
  }

  async listIngredients(locale: Locale): Promise<IngredientView[]> {
    const overlay = await this.overlay()
    return effectiveIngredients(overlay)
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
    const overlay = await this.overlay()

    return [
      ...seedCatalog.packageOptions.map((option) => ({
        id: option.slug,
        ingredientId: option.ingredientSlug,
        netAmount: seedAmountToDomain(option.netAmount),
        label: option.labels.en,
        preferred: option.preferred ?? false,
      })),
      // Sizes the owner confirmed from a real package they scanned, which are
      // better evidence than anything shipped in the catalog.
      ...overlay.packageOptions.map((option) => ({
        id: option.id,
        ingredientId: option.ingredientId,
        netAmount: seedAmountToDomain({
          kind: 'exact' as const,
          value: option.value,
          unit: option.unit as Unit,
        }),
        label: option.label,
        preferred: true,
      })),
    ]
  }

  async addPackageOption(input: {
    ingredientId: string
    label: string
    value: string
    unit: Unit
    barcode?: string | null
  }): Promise<{ id: string }> {
    const id = `pkg-${randomUUID().slice(0, 12)}`
    await this.mutate((overlay) => ({
      ...overlay,
      packageOptions: [
        {
          id,
          ingredientId: input.ingredientId,
          label: input.label,
          value: input.value,
          unit: input.unit,
          barcode: input.barcode ?? null,
        },
        // A rescan of the same package updates rather than piling up.
        ...overlay.packageOptions.filter(
          (option) =>
            !(
              option.ingredientId === input.ingredientId &&
              option.value === input.value &&
              option.unit === input.unit
            ),
        ),
      ].slice(0, 200),
    }))
    return { id }
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

  // --- Pantry --------------------------------------------------------------

  async getPantry(locale: Locale): Promise<PantryItemView[]> {
    const overlay = await this.overlay()
    const ingredients = this.ingredientMap(overlay)

    return overlay.pantry.map((item) => {
      const ingredient = ingredients.get(item.ingredientId)
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

  async addPantryItem(input: {
    ingredientId: string
    amount: Amount
    location: StorageLocation
    expiresAt?: string | null
  }): Promise<void> {
    const amount =
      input.amount.kind === 'exact'
        ? { kind: 'exact' as const, value: input.amount.value.toString(), unit: input.amount.unit }
        : input.amount.kind === 'range'
          ? {
              kind: 'range' as const,
              min: input.amount.min.toString(),
              max: input.amount.max.toString(),
              unit: input.amount.unit,
            }
          : input.amount.kind === 'qualitative'
            ? { kind: 'qualitative' as const, unit: input.amount.unit }
            : { kind: 'unknown' as const }

    await this.mutate((overlay) => ({
      ...overlay,
      pantry: [
        ...overlay.pantry,
        {
          id: `pantry-${randomUUID().slice(0, 8)}`,
          ingredientId: input.ingredientId,
          amount,
          location: input.location,
          openedAt: null,
          purchasedAt: new Date().toISOString(),
          expiresAt: input.expiresAt ?? null,
        },
      ],
    }))
  }

  async removePantryItem(id: string): Promise<void> {
    await this.mutate((overlay) => ({
      ...overlay,
      pantry: overlay.pantry.filter((item) => item.id !== id),
    }))
  }

  // --- Plan ----------------------------------------------------------------

  async getPlan(): Promise<MealPlanView> {
    const overlay = await this.overlay()
    return {
      id: overlay.plan.id,
      serveAt: overlay.plan.serveAt,
      notes: overlay.plan.notes,
      entries: overlay.plan.entries,
    }
  }

  async savePlan(plan: MealPlanView): Promise<void> {
    await this.mutate((overlay) => ({
      ...overlay,
      plan: {
        id: plan.id || 'demo-plan',
        serveAt: plan.serveAt,
        notes: plan.notes,
        entries: plan.entries,
      },
    }))
  }

  // --- Cooking -------------------------------------------------------------

  async listCookSessions(locale: Locale): Promise<CookSessionView[]> {
    const overlay = await this.overlay()
    const recipes = new Map(effectiveRecipes(overlay).map((r) => [r.slug, r]))

    return overlay.sessions
      .map((session) => {
        const recipe = recipes.get(session.recipeId)
        return {
          id: session.id,
          recipeId: session.recipeId,
          recipeName: recipe
            ? resolveText(recipe.names, locale, recipe.originLocale)
            : { value: session.recipeId, fallbackFrom: null },
          versionId: session.versionId,
          versionNumber:
            overlay.versions.find((version) => version.id === session.versionId)?.versionNumber ??
            null,
          startedAt: session.startedAt,
          finishedAt: session.finishedAt,
          scaleFactor: session.scaleFactor,
          rating: session.rating,
          tasteRating: session.tasteRating,
          crustRating: session.crustRating,
          handlingRating: session.handlingRating,
          actualActiveMinutes: session.actualActiveMinutes,
          actualPassiveMinutes: session.actualPassiveMinutes,
          nextTime: session.nextTime,
          notes: session.notes,
          completedStepIds: session.completedStepIds,
          media: mediaViews(session.media, locale),
        }
      })
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  async saveCookSession(session: CookSessionView): Promise<void> {
    await this.mutate((overlay) => {
      const rest = overlay.sessions.filter((s) => s.id !== session.id)
      return {
        ...overlay,
        sessions: [
          {
            id: session.id,
            recipeId: session.recipeId,
            // A session records which version was actually cooked, so history
            // stays meaningful after the recipe moves on. The caller knows
            // which one it rendered; the primary is only a fallback.
            versionId:
              session.versionId ??
              overlay.versions.find((v) => v.recipeId === session.recipeId && v.isPrimary)?.id ??
              null,
            startedAt: session.startedAt,
            finishedAt: session.finishedAt,
            scaleFactor: session.scaleFactor,
            rating: session.rating,
            tasteRating: session.tasteRating,
            crustRating: session.crustRating,
            handlingRating: session.handlingRating,
            actualActiveMinutes: session.actualActiveMinutes,
            actualPassiveMinutes: session.actualPassiveMinutes,
            nextTime: session.nextTime?.slice(0, 2000) ?? null,
            notes: session.notes?.slice(0, 2000) ?? null,
            completedStepIds: session.completedStepIds,
            media: session.media.map((photo) => ({
              id: photo.id,
              storagePath: null,
              url: null,
              alt: { ru: photo.alt ?? '', en: photo.alt ?? '', fr: photo.alt ?? '' },
              isCover: photo.isCover,
            })),
          },
          ...rest,
        ].slice(0, 200),
      }
    })
  }

  // --- Settings ------------------------------------------------------------

  async getSettings(): Promise<UserSettingsView> {
    const overlay = await this.overlay()
    return { ...overlay.settings, locale: 'ru' }
  }

  async saveSettings(settings: Partial<UserSettingsView>): Promise<void> {
    await this.mutate((overlay) => ({
      ...overlay,
      settings: {
        temperatureUnit: settings.temperatureUnit ?? overlay.settings.temperatureUnit,
        defaultDiameterMm: settings.defaultDiameterMm ?? overlay.settings.defaultDiameterMm,
        defaultBallWeightG: settings.defaultBallWeightG ?? overlay.settings.defaultBallWeightG,
        defaultOvenProfileId:
          settings.defaultOvenProfileId === undefined
            ? overlay.settings.defaultOvenProfileId
            : settings.defaultOvenProfileId,
        includeExperimental:
          settings.includeExperimental ?? overlay.settings.includeExperimental,
      },
    }))
  }

  // --- Authoring -----------------------------------------------------------

  async saveRecipe(draft: RecipeDraft): Promise<SaveRecipeResult> {
    const issues = validateDraft(draft)
    if (issues.length > 0) {
      throw new RepositoryError('The recipe is not valid', 'validation', issues)
    }

    const overlay = await this.overlay()
    const existing = draft.slug ? findRecipe(overlay, draft.slug) : null
    const taken = new Set(effectiveRecipes(overlay).map((r) => r.slug))
    if (draft.slug) taken.delete(draft.slug)

    const slug = existing?.slug ?? draft.slug ?? uniqueSlug(
      draft.names[draft.originLocale] || draft.names.en || draft.names.ru,
      taken,
    )

    // Cycle check across the *effective* catalog, so a component added here
    // cannot close a loop through recipes that already exist.
    const itemsBySlug = new Map(
      effectiveRecipes(overlay).map((r) => [r.slug, r.items.map((i) => ({ componentSlug: i.componentSlug }))]),
    )
    const cycle = findComponentCycle(draft, slug, itemsBySlug)
    if (cycle) {
      throw new RepositoryError('A recipe cannot contain itself', 'cycle', cycle)
    }

    const stored = draftToStored(draft, slug)

    // A verified recipe that changes gets an immutable snapshot of what it was,
    // so the previous version is never destroyed.
    const shouldVersion =
      Boolean(existing) && (draft.createVersion || existing?.status === 'verified')

    await this.mutate((current) => {
      const versions = [...current.versions]
      if (shouldVersion && existing) {
        const previous = versions.filter((v) => v.recipeId === slug)
        versions.push({
          id: `version-${randomUUID().slice(0, 12)}`,
          recipeId: slug,
          versionNumber: previous.length + 1,
          createdAt: new Date().toISOString(),
          isPrimary: false,
          note: draft.versionNote,
          snapshot: existing,
        })
      }

      return {
        ...current,
        recipes: { ...current.recipes, [slug]: stored },
        deletedRecipeSlugs: current.deletedRecipeSlugs.filter((s) => s !== slug),
        versions,
      }
    })

    return { slug, created: !existing, versionCreated: shouldVersion }
  }

  async deleteRecipe(slug: string): Promise<void> {
    await this.mutate((overlay) => {
      const rest = Object.fromEntries(
        Object.entries(overlay.recipes).filter(([key]) => key !== slug),
      )
      return {
        ...overlay,
        recipes: rest,
        // Seed recipes cannot be removed, only hidden.
        deletedRecipeSlugs: [...new Set([...overlay.deletedRecipeSlugs, slug])],
      }
    })
  }

  async getRecipeDraft(slug: string): Promise<RecipeDraft | null> {
    const recipe = findRecipe(await this.overlay(), slug)
    return recipe ? storedToDraft(recipe) : null
  }

  // --- Versions ------------------------------------------------------------

  async listVersions(recipeId: string): Promise<RecipeVersionView[]> {
    const overlay = await this.overlay()
    return overlay.versions
      .filter((version) => version.recipeId === recipeId)
      .map((version) => ({
        id: version.id,
        recipeId: version.recipeId,
        versionNumber: version.versionNumber,
        createdAt: version.createdAt,
        isPrimary: version.isPrimary,
        note: version.note,
      }))
      .sort((a, b) => b.versionNumber - a.versionNumber)
  }

  async getVersionDraft(versionId: string): Promise<RecipeDraft | null> {
    const overlay = await this.overlay()
    const version = overlay.versions.find((candidate) => candidate.id === versionId)
    if (!version) return null
    return storedToDraft(version.snapshot as SeedRecipe)
  }

  async makeVersionPrimary(versionId: string): Promise<void> {
    const overlay = await this.overlay()
    const version = overlay.versions.find((candidate) => candidate.id === versionId)
    if (!version) throw new RepositoryError('No such version', 'not_found')

    const snapshot = version.snapshot as SeedRecipe
    const current = findRecipe(overlay, version.recipeId)

    await this.mutate((state) => {
      const versions = [...state.versions]
      // Restoring keeps the version that is being replaced, so nothing is lost
      // by going back.
      if (current) {
        versions.push({
          id: `version-${randomUUID().slice(0, 12)}`,
          recipeId: version.recipeId,
          versionNumber: versions.filter((v) => v.recipeId === version.recipeId).length + 1,
          createdAt: new Date().toISOString(),
          isPrimary: false,
          note: 'Replaced when an earlier version was restored',
          snapshot: current,
        })
      }

      return {
        ...state,
        recipes: { ...state.recipes, [version.recipeId]: snapshot },
        versions: versions.map((candidate) =>
          candidate.recipeId === version.recipeId
            ? { ...candidate, isPrimary: candidate.id === versionId }
            : candidate,
        ),
      }
    })
  }

  // --- Review --------------------------------------------------------------

  async listOpenQuestions(locale: Locale): Promise<OpenQuestionView[]> {
    const overlay = await this.overlay()
    const ingredients = this.ingredientMap(overlay)
    const recipes = effectiveRecipes(overlay)
    const recipeBySlug = new Map(recipes.map((r) => [r.slug, r]))
    const questions: OpenQuestionView[] = []

    for (const recipe of recipes) {
      const recipeName = resolveText(recipe.names, locale, recipe.originLocale)

      // Every unknown amount is a question the owner can answer directly.
      for (const item of recipe.items) {
        if (item.amount.kind !== 'unknown') continue
        const subject = item.ingredientSlug
          ? (ingredients.get(item.ingredientSlug)
              ? resolveText(ingredients.get(item.ingredientSlug)!.names, locale)
              : { value: item.ingredientSlug, fallbackFrom: null })
          : item.componentSlug
            ? (recipeBySlug.get(item.componentSlug)
                ? resolveText(
                    recipeBySlug.get(item.componentSlug)!.names,
                    locale,
                    recipeBySlug.get(item.componentSlug)!.originLocale,
                  )
                : { value: item.componentSlug, fallbackFrom: null })
            : { value: item.key, fallbackFrom: null }

        questions.push({
          id: `${recipe.slug}:amount:${item.key}`,
          recipeId: recipe.slug,
          recipeSlug: recipe.slug,
          recipeName,
          itemId: `${recipe.slug}:${item.key}`,
          itemKey: item.key,
          subject,
          field: 'item.amount',
          reviewState: 'needs_review',
          conflictGroup: null,
          note: null,
          currentAmount: seedAmountToDomain(item.amount),
          kind: 'amount',
        })
      }

      // A component with no yield cannot be broken down at all.
      if (recipe.baseYield === null && (recipe.type === 'sauce' || recipe.type === 'prep')) {
        questions.push({
          id: `${recipe.slug}:yield`,
          recipeId: recipe.slug,
          recipeSlug: recipe.slug,
          recipeName,
          itemId: null,
          itemKey: null,
          subject: recipeName,
          field: 'recipe.baseYield',
          reviewState: 'needs_review',
          conflictGroup: null,
          note: optionalText(recipe.notes, locale, recipe.originLocale),
          currentAmount: null,
          kind: 'yield',
        })
      }

      for (const [index, evidence] of (recipe.evidence ?? []).entries()) {
        if (evidence.reviewState !== 'needs_review' && evidence.reviewState !== 'conflict') {
          continue
        }
        // An unknown amount already produced a question above; do not repeat it.
        if (
          evidence.itemKey &&
          recipe.items.find((i) => i.key === evidence.itemKey)?.amount.kind === 'unknown'
        ) {
          continue
        }
        if (evidence.field === 'recipe.baseYield' && recipe.baseYield === null) continue

        const item = evidence.itemKey
          ? recipe.items.find((i) => i.key === evidence.itemKey)
          : undefined

        questions.push({
          id: `${recipe.slug}:evidence:${index}`,
          recipeId: recipe.slug,
          recipeSlug: recipe.slug,
          recipeName,
          itemId: evidence.itemKey ? `${recipe.slug}:${evidence.itemKey}` : null,
          itemKey: evidence.itemKey ?? null,
          subject:
            item?.ingredientSlug && ingredients.get(item.ingredientSlug)
              ? resolveText(ingredients.get(item.ingredientSlug)!.names, locale)
              : recipeName,
          field: evidence.field,
          reviewState: evidence.reviewState,
          conflictGroup: evidence.conflictGroup ?? null,
          note: resolveText(evidence.notes, locale, recipe.originLocale),
          currentAmount: item ? seedAmountToDomain(item.amount) : null,
          kind:
            evidence.field === 'recipe.baseYield'
              ? 'yield'
              : evidence.field === 'item.ingredient'
                ? 'ingredient'
                : item
                  ? 'amount'
                  : 'other',
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
    const overlay = await this.overlay()
    const taken = new Set(effectiveIngredients(overlay).map((i) => i.slug))
    const slug = uniqueSlug(input.names.en || input.names.ru || input.names.fr, taken)

    const ingredient: SeedIngredient = {
      slug,
      categorySlug: input.categorySlug,
      measure: input.measure as SeedIngredient['measure'],
      baseUnit: input.baseUnit,
      names: input.names,
      aliases: input.aliases?.length ? { en: input.aliases } : undefined,
    }

    await this.mutate((state) => ({
      ...state,
      ingredients: { ...state.ingredients, [slug]: ingredient },
    }))

    return slug
  }

  // --- Idempotency ---------------------------------------------------------

  async findAppliedMutation(idempotencyKey: string): Promise<string | null> {
    const overlay = await this.overlay()
    const slug = overlay.appliedMutations[idempotencyKey]
    // A key whose recipe has since been deleted is treated as unused, so the
    // owner can save it again rather than being pointed at nothing.
    if (!slug) return null
    return findRecipe(overlay, slug) ? slug : null
  }

  async recordAppliedMutation(idempotencyKey: string, slug: string): Promise<void> {
    await this.mutate((overlay) => {
      // Bounded: the guard only needs the recent past.
      const entries = [
        [idempotencyKey, slug] as const,
        ...Object.entries(overlay.appliedMutations).filter(([key]) => key !== idempotencyKey),
      ].slice(0, 200)
      return { ...overlay, appliedMutations: Object.fromEntries(entries) }
    })
  }

  // --- Media ---------------------------------------------------------------

  /**
   * Demo mode keeps the bytes in the browser.
   *
   * There is nowhere sensible to put a photograph server-side here: the demo
   * has no account to attach it to, and writing megabytes into the session
   * overlay would make every page read slower for everyone. The client stores
   * the Blob in IndexedDB under the same id and resolves it at render time, so
   * this call has nothing to upload and says so by returning no path.
   */
  async uploadMedia(): Promise<{ storagePath: null }> {
    return { storagePath: null }
  }

  async deleteMediaObjects(): Promise<void> {
    // Nothing is stored server-side, so there is nothing to orphan. The client
    // clears its own IndexedDB entries when a photo is removed.
  }

  // --- Experiments ---------------------------------------------------------

  async listExperiments(locale: Locale): Promise<ExperimentView[]> {
    const overlay = await this.overlay()
    const recipes = new Map(effectiveRecipes(overlay).map((r) => [r.slug, r]))

    return overlay.experiments
      .map((experiment) => {
        const recipe = recipes.get(experiment.recipeSlug)
        return {
          id: experiment.id,
          title: experiment.title,
          recipeId: experiment.recipeSlug,
          recipeSlug: experiment.recipeSlug,
          recipeName: recipe
            ? resolveText(recipe.names, locale, recipe.originLocale)
            : { value: experiment.recipeSlug, fallbackFrom: null },
          versionIds: experiment.versionIds,
          sessionIds: experiment.sessionIds,
          hypothesis: experiment.hypothesis,
          conclusion: experiment.conclusion,
          winningVersionId: experiment.winningVersionId,
          createdAt: experiment.createdAt,
        }
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async saveExperiment(input: {
    id: string | null
    recipeSlug: string
    title: string
    versionIds: string[]
    sessionIds: string[]
    hypothesis: string | null
    conclusion: string | null
    winningVersionId: string | null
  }): Promise<{ id: string }> {
    const overlay = await this.overlay()
    if (!findRecipe(overlay, input.recipeSlug)) {
      throw new RepositoryError('No such recipe', 'not_found')
    }

    const id = input.id ?? `exp-${randomUUID().slice(0, 12)}`
    const existing = overlay.experiments.find((experiment) => experiment.id === id)

    await this.mutate((current) => ({
      ...current,
      experiments: [
        {
          id,
          recipeSlug: input.recipeSlug,
          title: input.title,
          versionIds: input.versionIds,
          sessionIds: input.sessionIds,
          hypothesis: input.hypothesis,
          conclusion: input.conclusion,
          winningVersionId: input.winningVersionId,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        },
        ...current.experiments.filter((experiment) => experiment.id !== id),
      ].slice(0, 100),
    }))

    return { id }
  }

  async deleteExperiment(id: string): Promise<void> {
    await this.mutate((overlay) => ({
      ...overlay,
      experiments: overlay.experiments.filter((experiment) => experiment.id !== id),
    }))
  }

  // --- Demo housekeeping ---------------------------------------------------

  async resetDemoData(): Promise<void> {
    const sessionId = await readSessionId()
    if (sessionId) await resetOverlay(sessionId)
  }
}
