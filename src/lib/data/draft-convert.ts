import type { Locale } from '@/domain'
import type { SeedAmount, SeedRecipe } from '@/lib/seed/types'
import { LOCALE_KEYS, type DraftAmount, type RecipeDraft } from './recipe-draft'

/**
 * Conversion between the editor's draft shape and the seed catalog's authoring
 * shape.
 *
 * Demo mode stores user recipes as `SeedRecipe`, which already carries
 * translations, items, steps, source and evidence -- so a recipe the owner
 * writes is structurally identical to one that shipped with the app, and every
 * projection that already worked keeps working.
 */

function normalizeDecimal(value: string): string {
  return value.trim().replace(',', '.')
}

export function draftAmountToSeed(amount: DraftAmount): SeedAmount {
  switch (amount.kind) {
    case 'exact':
      return { kind: 'exact', value: normalizeDecimal(amount.value), unit: amount.unit as never }
    case 'range':
      return {
        kind: 'range',
        min: normalizeDecimal(amount.min),
        max: normalizeDecimal(amount.max),
        unit: amount.unit as never,
      }
    case 'qualitative':
      return { kind: 'qualitative', unit: amount.unit as never }
    case 'unknown':
      return { kind: 'unknown' }
  }
}

export function seedAmountToDraft(amount: SeedAmount): DraftAmount {
  switch (amount.kind) {
    case 'exact':
      return { kind: 'exact', value: amount.value, unit: amount.unit }
    case 'range':
      return { kind: 'range', min: amount.min, max: amount.max, unit: amount.unit }
    case 'qualitative':
      return { kind: 'qualitative', unit: amount.unit }
    case 'unknown':
      return { kind: 'unknown' }
  }
}

type Localized = Record<Locale, string>

/** Blank strings are dropped so the fallback chain can do its job. */
function trimmedLocalized(value: Localized): Partial<Localized> {
  const out: Partial<Localized> = {}
  for (const locale of LOCALE_KEYS) {
    const text = value[locale]?.trim()
    if (text) out[locale] = text
  }
  return out
}

function filledLocalized(value: Partial<Localized> | undefined): Localized {
  return {
    ru: value?.ru ?? '',
    en: value?.en ?? '',
    fr: value?.fr ?? '',
  }
}

/** A required localized field still needs all three keys present. */
function requiredLocalized(value: Localized, origin: Locale): Localized {
  const fallback = value[origin]?.trim() || value.ru || value.en || value.fr || ''
  return {
    ru: value.ru?.trim() || fallback,
    en: value.en?.trim() || fallback,
    fr: value.fr?.trim() || fallback,
  }
}

export function draftToStored(draft: RecipeDraft, slug: string): SeedRecipe {
  return {
    slug,
    type: draft.type,
    status: draft.status,
    authenticity: draft.authenticity,
    styleSlug: draft.styleSlug,
    ovenProfileSlug: draft.ovenProfileSlug,
    originLocale: draft.originLocale,
    baseYield: draft.baseYield ? normalizeDecimal(draft.baseYield) : null,
    yieldUnit: (draft.yieldUnit ?? null) as SeedRecipe['yieldUnit'],
    baseDiameterMm: draft.baseDiameterMm,
    baseShape: draft.baseShape,
    baseTrayWidthMm: draft.baseTrayWidthMm,
    baseTrayHeightMm: draft.baseTrayHeightMm,
    baseBallWeightG: draft.baseBallWeightG ? normalizeDecimal(draft.baseBallWeightG) : null,
    activeMinutes: draft.activeMinutes,
    passiveMinutes: draft.passiveMinutes,
    difficulty: draft.difficulty as SeedRecipe['difficulty'],
    tags: draft.tags,
    names: requiredLocalized(draft.names, draft.originLocale),
    summaries: trimmedLocalized(draft.summaries),
    notes: trimmedLocalized(draft.notes),
    items: draft.items.map((item) => ({
      key: item.key,
      ingredientSlug: item.ingredientSlug ?? undefined,
      componentSlug: item.componentSlug ?? undefined,
      amount: draftAmountToSeed(item.amount),
      optional: item.optional,
      group: item.group,
      notes: item.notes ? trimmedLocalized(item.notes) : undefined,
    })),
    steps: draft.steps.map((step) => ({
      key: step.key,
      phase: step.phase,
      activeMinutes: step.activeMinutes,
      waitMinMinutes: step.waitMinMinutes,
      waitMaxMinutes: step.waitMaxMinutes,
      durationKnown: step.durationKnown,
      temperatureC: step.temperatureC,
      timerSeconds: step.timerSeconds,
      itemKeys: step.itemKeys,
      instructions: requiredLocalized(step.instructions, draft.originLocale),
      cues: step.cues ? trimmedLocalized(step.cues) : undefined,
      troubleshooting: step.troubleshooting ? trimmedLocalized(step.troubleshooting) : undefined,
    })),
    source: draft.source
      ? {
          sourceType: draft.source.sourceType,
          author: draft.source.author,
          title: draft.source.title,
          url: draft.source.url,
          credibilityTier: draft.source.credibilityTier,
          attribution: draft.source.attribution,
        }
      : undefined,
    aiTranslatedLocales: draft.aiTranslatedLocales,
    media: draft.media.map((photo) => ({
      id: photo.id,
      storagePath: photo.storagePath,
      url: photo.url,
      alt: trimmedLocalized(photo.alt),
      isCover: photo.isCover,
    })),
    evidence: draft.evidence.map((entry) => ({
      field: entry.field,
      itemKey: entry.itemKey,
      confidence: entry.confidence,
      reviewState: entry.reviewState,
      conflictGroup: entry.conflictGroup,
      startSeconds: entry.startSeconds,
      notes: requiredLocalized(filledLocalized(entry.notes), draft.originLocale),
    })),
  }
}

export function storedToDraft(recipe: SeedRecipe): RecipeDraft {
  return {
    slug: recipe.slug,
    type: recipe.type,
    // `archived` is not offered in the editor; treat it as a draft.
    status: recipe.status === 'archived' ? 'draft' : recipe.status,
    authenticity: recipe.authenticity,
    styleSlug: recipe.styleSlug ?? null,
    ovenProfileSlug: recipe.ovenProfileSlug ?? null,
    originLocale: recipe.originLocale,
    baseYield: recipe.baseYield ?? null,
    yieldUnit: recipe.yieldUnit ?? null,
    baseDiameterMm: recipe.baseDiameterMm ?? null,
    baseShape: recipe.baseShape ?? null,
    baseTrayWidthMm: recipe.baseTrayWidthMm ?? null,
    baseTrayHeightMm: recipe.baseTrayHeightMm ?? null,
    baseBallWeightG: recipe.baseBallWeightG ?? null,
    activeMinutes: recipe.activeMinutes ?? null,
    passiveMinutes: recipe.passiveMinutes ?? null,
    difficulty: recipe.difficulty ?? null,
    tags: recipe.tags ?? [],
    names: filledLocalized(recipe.names),
    summaries: filledLocalized(recipe.summaries),
    notes: filledLocalized(recipe.notes),
    items: recipe.items.map((item) => ({
      key: item.key,
      ingredientSlug: item.ingredientSlug ?? null,
      componentSlug: item.componentSlug ?? null,
      amount: seedAmountToDraft(item.amount),
      optional: item.optional ?? false,
      group: item.group ?? null,
      notes: filledLocalized(item.notes),
    })),
    steps: recipe.steps.map((step) => ({
      key: step.key,
      phase: step.phase,
      activeMinutes: step.activeMinutes ?? 0,
      waitMinMinutes: step.waitMinMinutes ?? 0,
      waitMaxMinutes: step.waitMaxMinutes ?? step.waitMinMinutes ?? 0,
      durationKnown: step.durationKnown ?? true,
      temperatureC: step.temperatureC ?? null,
      timerSeconds: step.timerSeconds ?? null,
      itemKeys: step.itemKeys ?? [],
      instructions: filledLocalized(step.instructions),
      cues: filledLocalized(step.cues),
      troubleshooting: filledLocalized(step.troubleshooting),
    })),
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
    evidence: (recipe.evidence ?? []).map((entry) => ({
      field: entry.field,
      itemKey: entry.itemKey ?? null,
      confidence: entry.confidence,
      reviewState: entry.reviewState,
      conflictGroup: entry.conflictGroup ?? null,
      startSeconds: entry.startSeconds ?? null,
      notes: filledLocalized(entry.notes),
    })),
    aiTranslatedLocales: recipe.aiTranslatedLocales ?? [],
    media: (recipe.media ?? []).map((photo) => ({
      id: photo.id,
      storagePath: photo.storagePath ?? null,
      url: photo.url ?? null,
      alt: {
        ru: photo.alt?.ru ?? '',
        en: photo.alt?.en ?? '',
        fr: photo.alt?.fr ?? '',
      },
      isCover: photo.isCover ?? false,
    })),
    createVersion: false,
    versionNote: null,
  }
}

/**
 * Rejects a component link that would close a loop.
 *
 * The database enforces this with a trigger and the domain layer detects it
 * during expansion; this third check exists so the editor can refuse a bad
 * save with a readable message instead of surfacing a constraint violation.
 */
export function findComponentCycle(
  draft: RecipeDraft,
  slug: string,
  recipeItemsBySlug: ReadonlyMap<string, { componentSlug?: string | null }[]>,
): string[] | null {
  const componentsOf = (candidate: string): string[] => {
    if (candidate === slug) {
      return draft.items.flatMap((item) => (item.componentSlug ? [item.componentSlug] : []))
    }
    return (recipeItemsBySlug.get(candidate) ?? []).flatMap((item) =>
      item.componentSlug ? [item.componentSlug] : [],
    )
  }

  const path: string[] = []
  const visiting = new Set<string>()

  const walk = (candidate: string): string[] | null => {
    if (visiting.has(candidate)) return [...path, candidate]
    visiting.add(candidate)
    path.push(candidate)
    for (const next of componentsOf(candidate)) {
      const cycle = walk(next)
      if (cycle) return cycle
    }
    path.pop()
    visiting.delete(candidate)
    return null
  }

  return walk(slug)
}
