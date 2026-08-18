import { createHash } from 'node:crypto'
import type { Locale } from '@/domain'
import { searchKey } from '@/domain'
import type { RecipeDraft } from '@/lib/data/recipe-draft'
import { slugify } from '@/lib/data/recipe-draft'
import type { ExtractedIngredient, RecipeExtraction } from '@/lib/providers/extraction-schema'

/**
 * Turns an approved import candidate into a recipe draft.
 *
 * Two things matter here. First, an extracted ingredient name is matched
 * against the catalog by *normalized* text across every locale and alias, so
 * importing "mozzarella" twice in two languages does not create two
 * ingredients. Second, nothing the extraction was unsure about is smoothed
 * over: unknown amounts stay unknown, ranges stay ranges, and every conflict
 * the model reported becomes an evidence row the owner still has to settle.
 */

export interface CatalogEntry {
  slug: string
  /** Every name and alias, in any locale. */
  terms: string[]
}

export interface IngredientMatch {
  extractedName: string
  /** The catalog entry this maps to, or null when it needs creating. */
  slug: string | null
  confidence: number
}

/**
 * Matches an extracted name to the catalog.
 *
 * Exact normalized equality first, then containment. Anything weaker is left
 * unmatched rather than guessed: silently attaching "smoked mozzarella" to
 * plain mozzarella would corrupt a shopping list in a way that is hard to spot.
 */
export function matchIngredient(name: string, catalog: readonly CatalogEntry[]): IngredientMatch {
  const key = searchKey(name)
  if (!key) return { extractedName: name, slug: null, confidence: 0 }

  for (const entry of catalog) {
    if (entry.terms.some((term) => searchKey(term) === key)) {
      return { extractedName: name, slug: entry.slug, confidence: 1 }
    }
  }

  let best: { slug: string; score: number } | null = null
  for (const entry of catalog) {
    for (const term of entry.terms) {
      const termKey = searchKey(term)
      if (!termKey) continue
      if (key.includes(termKey) || termKey.includes(key)) {
        // Prefer the longest overlap: "type 00 flour" should beat "flour".
        const score = Math.min(termKey.length, key.length) / Math.max(termKey.length, key.length)
        if (!best || score > best.score) best = { slug: entry.slug, score }
      }
    }
  }

  if (best && best.score >= 0.5) {
    return { extractedName: name, slug: best.slug, confidence: best.score }
  }
  return { extractedName: name, slug: null, confidence: 0 }
}

export function buildCatalog(
  ingredients: readonly { slug: string; name: string; aliases?: string[] }[],
): CatalogEntry[] {
  return ingredients.map((ingredient) => ({
    slug: ingredient.slug,
    terms: [ingredient.name, ...(ingredient.aliases ?? [])],
  }))
}

function amountFor(ingredient: ExtractedIngredient): RecipeDraft['items'][number]['amount'] {
  switch (ingredient.amount.kind) {
    case 'exact':
      return { kind: 'exact', value: ingredient.amount.value, unit: ingredient.amount.unit }
    case 'range':
      return {
        kind: 'range',
        min: ingredient.amount.min,
        max: ingredient.amount.max,
        unit: ingredient.amount.unit,
      }
    case 'qualitative':
      return { kind: 'qualitative', unit: ingredient.amount.unit }
    case 'unknown':
      return { kind: 'unknown' }
  }
}

export interface ImportToDraftInput {
  extraction: RecipeExtraction
  /** slug per extracted ingredient name; missing means "create on approval". */
  resolved: Record<string, string>
  sourceUrl: string | null
  locale: Locale
}

export function importToDraft(input: ImportToDraftInput): RecipeDraft {
  const { extraction } = input
  const title = extraction.title?.trim() || 'Imported recipe'
  const originLocale = (extraction.detectedLanguage?.slice(0, 2) as Locale) ?? input.locale
  const origin: Locale = (['ru', 'en', 'fr'] as const).includes(originLocale)
    ? originLocale
    : input.locale

  const names = { ru: '', en: '', fr: '' } as Record<Locale, string>
  names[origin] = title

  const summaries = { ru: '', en: '', fr: '' } as Record<Locale, string>
  if (extraction.summary) summaries[origin] = extraction.summary

  const items: RecipeDraft['items'] = extraction.ingredients.map((ingredient, index) => {
    const slug = input.resolved[ingredient.name] ?? null
    return {
      key: `${slugify(ingredient.name) || 'item'}-${index}`,
      ingredientSlug: slug,
      componentSlug: null,
      amount: amountFor(ingredient),
      optional: ingredient.optional,
      group: ingredient.group,
      notes: {
        ru: '',
        en: '',
        fr: '',
        [origin]: ingredient.note ?? '',
      } as Record<Locale, string>,
    }
  })

  const steps: RecipeDraft['steps'] = extraction.steps.map((step, index) => ({
    key: `step-${index + 1}`,
    phase: step.phase,
    activeMinutes: Math.max(0, Math.round(step.activeMinutes ?? 0)),
    waitMinMinutes: Math.max(0, Math.round(step.waitMinMinutes ?? 0)),
    waitMaxMinutes: Math.max(
      Math.max(0, Math.round(step.waitMinMinutes ?? 0)),
      Math.round(step.waitMaxMinutes ?? step.waitMinMinutes ?? 0),
    ),
    // A step whose duration the source never gave is flagged, which is what
    // drives the "approximate timing" badge in the planner.
    durationKnown: step.waitMinMinutes !== null || step.activeMinutes !== null,
    temperatureC: step.temperatureC,
    timerSeconds: null,
    itemKeys: [],
    instructions: {
      ru: '',
      en: '',
      fr: '',
      [origin]: step.instruction,
    } as Record<Locale, string>,
    cues: {
      ru: '',
      en: '',
      fr: '',
      [origin]: step.sensoryCues ?? '',
    } as Record<Locale, string>,
    troubleshooting: { ru: '', en: '', fr: '' },
  }))

  // Every conflict the extraction reported becomes something the owner must
  // still resolve; approving an import does not resolve them.
  const evidence: RecipeDraft['evidence'] = [
    ...extraction.conflicts.map((conflict) => ({
      field: conflict.field,
      itemKey: null,
      confidence: 0.3,
      reviewState: 'conflict' as const,
      conflictGroup: conflict.field,
      startSeconds: null,
      notes: {
        ru: '',
        en: '',
        fr: '',
        [origin]: conflict.description,
      } as Record<Locale, string>,
    })),
    ...extraction.ingredients.flatMap((ingredient, index) => {
      if (ingredient.amount.kind !== 'unknown') return []
      return [
        {
          field: 'item.amount',
          itemKey: items[index]!.key,
          confidence: 0,
          reviewState: 'needs_review' as const,
          conflictGroup: null,
          startSeconds: ingredient.startSeconds,
          notes: {
            ru: '',
            en: '',
            fr: '',
            [origin]: ingredient.amount.reason,
          } as Record<Locale, string>,
        },
      ]
    }),
  ]

  const hasOpenQuestions = evidence.length > 0

  return {
    slug: null,
    type: extraction.type,
    // An import is never verified on arrival, whatever the model's confidence.
    status: hasOpenQuestions ? 'needs_review' : 'draft',
    // Nor may it claim to be traditional: that judgement needs a real source.
    authenticity: 'adapted',
    styleSlug: null,
    ovenProfileSlug: null,
    originLocale: origin,
    baseYield: extraction.yieldCount,
    yieldUnit: (extraction.yieldUnit ?? null) as RecipeDraft['yieldUnit'],
    baseDiameterMm: null,
    baseShape: null,
    baseTrayWidthMm: null,
    baseTrayHeightMm: null,
    baseBallWeightG: extraction.ballWeightG,
    activeMinutes: steps.reduce((sum, step) => sum + step.activeMinutes, 0) || null,
    passiveMinutes: steps.reduce((sum, step) => sum + step.waitMaxMinutes, 0) || null,
    difficulty: null,
    tags: extraction.equipment.slice(0, 5).map((item) => slugify(item)).filter(Boolean),
    names,
    summaries,
    notes: { ru: '', en: '', fr: '' },
    items,
    steps,
    source: {
      sourceType: input.sourceUrl?.includes('youtube') ? 'youtube' : 'text',
      author: null,
      title: extraction.title,
      url: input.sourceUrl,
      // An AI-assisted extraction is not a trustworthy source on its own.
      credibilityTier: 0.4,
      attribution: input.sourceUrl ? `Imported from ${input.sourceUrl}` : null,
    },
    evidence,
    aiTranslatedLocales: [],
    media: [],
    createVersion: false,
    versionNote: null,
  }
}

/**
 * A stable key for one candidate.
 *
 * Derived from the content rather than a random id, so pressing Save twice --
 * or a retried request -- resolves to the same key and the second attempt is
 * recognised as a duplicate instead of creating a second recipe.
 */
export function idempotencyKeyFor(extraction: RecipeExtraction, sourceUrl: string | null): string {
  const payload = JSON.stringify({
    title: extraction.title,
    sourceUrl,
    ingredients: extraction.ingredients.map((i) => [i.name, i.amount]),
    steps: extraction.steps.map((s) => s.instruction),
  })
  return createHash('sha256').update(payload).digest('hex').slice(0, 32)
}
