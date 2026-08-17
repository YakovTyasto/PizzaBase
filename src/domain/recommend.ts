import { Decimal } from 'decimal.js'
import { type Amount, isNumeric, upperBound } from './amount'
import { RecipeCycleError, expandRecipe } from './expand'
import type { AuthenticityClass, RecipeGraph, RecipeStatus } from './model'
import { type PantryEntry, buildShoppingList } from './shopping'

/**
 * Ranking is ordinary code, start to finish. An LLM may later write a sentence
 * explaining a result, but the candidate set, the quantities and the missing
 * list are computed here so they can be tested and cannot hallucinate.
 */

export interface RecommendationCandidate {
  recipeId: string
  authenticity: AuthenticityClass
  status: RecipeStatus
  styleId: string | null
  /** Higher is better: official spec > named pizzaiolo > user > AI-assisted. */
  sourceCredibility: number
  totalMinutes: number | null
  ovenProfileId: string | null
}

export interface MissingIngredient {
  ingredientId: string
  required: Amount | null
  available: Amount | null
  short: Amount | null
  optional: boolean
}

export interface Recommendation {
  recipeId: string
  /** 0..1 share of required (non-optional, numeric) ingredients fully covered. */
  coverage: number
  missing: MissingIngredient[]
  missingRequiredCount: number
  canCookNow: boolean
  score: number
  reasons: RecommendationReason[]
}

export type RecommendationReason =
  | { kind: 'coverage'; coverage: number }
  | { kind: 'authenticity'; value: AuthenticityClass }
  | { kind: 'credibility'; value: number }
  | { kind: 'time'; minutes: number }
  | { kind: 'oven_match' }
  | { kind: 'missing_only_optional' }

export interface RecommendOptions {
  /** Experimental recipes are opt-in; the default set is the trustworthy three. */
  includeExperimental?: boolean
  /** Only recommend recipes whose ingredients are documented. */
  minStatus?: RecipeStatus[]
  ovenProfileId?: string | null
  maxTotalMinutes?: number | null
  limit?: number
}

const DEFAULT_CLASSES: AuthenticityClass[] = [
  'traditional',
  'pizzaiolo',
  'modern_italian',
  'user_verified',
]

const AUTHENTICITY_WEIGHT: Record<AuthenticityClass, number> = {
  traditional: 1,
  pizzaiolo: 0.95,
  modern_italian: 0.8,
  user_verified: 0.75,
  adapted: 0.6,
  experimental: 0.35,
}

/**
 * Scores every candidate against the pantry.
 *
 * Quality deliberately outranks fridge coverage: a well-sourced recipe missing
 * one ingredient should beat a shaky one you happen to have everything for.
 * That is the whole point of the authenticity and credibility weights.
 */
export function recommend(
  graph: RecipeGraph,
  candidates: readonly RecommendationCandidate[],
  pantry: readonly PantryEntry[],
  options: RecommendOptions = {},
): Recommendation[] {
  const allowedClasses = new Set<AuthenticityClass>(
    options.includeExperimental
      ? [...DEFAULT_CLASSES, 'adapted', 'experimental']
      : [...DEFAULT_CLASSES, 'adapted'],
  )
  const allowedStatus = new Set<RecipeStatus>(
    options.minStatus ?? ['verified', 'needs_review', 'draft'],
  )

  const results: Recommendation[] = []

  for (const candidate of candidates) {
    if (!allowedClasses.has(candidate.authenticity)) continue
    if (!allowedStatus.has(candidate.status)) continue
    if (
      options.maxTotalMinutes &&
      candidate.totalMinutes &&
      candidate.totalMinutes > options.maxTotalMinutes
    ) {
      continue
    }

    let evaluation: ReturnType<typeof evaluateCoverage>
    try {
      evaluation = evaluateCoverage(graph, candidate.recipeId, pantry)
    } catch (error) {
      // A cyclic recipe is a data bug, not a recommendation; skip it rather
      // than taking the whole screen down.
      if (error instanceof RecipeCycleError) continue
      throw error
    }

    const reasons: RecommendationReason[] = [
      { kind: 'coverage', coverage: evaluation.coverage },
      { kind: 'authenticity', value: candidate.authenticity },
      { kind: 'credibility', value: candidate.sourceCredibility },
    ]
    if (candidate.totalMinutes) reasons.push({ kind: 'time', minutes: candidate.totalMinutes })
    if (options.ovenProfileId && candidate.ovenProfileId === options.ovenProfileId) {
      reasons.push({ kind: 'oven_match' })
    }
    if (evaluation.missingRequiredCount === 0 && evaluation.missing.length > 0) {
      reasons.push({ kind: 'missing_only_optional' })
    }

    const qualityScore =
      AUTHENTICITY_WEIGHT[candidate.authenticity] * 0.6 +
      Math.min(candidate.sourceCredibility, 1) * 0.4

    const timeBonus =
      candidate.totalMinutes && options.maxTotalMinutes
        ? Math.max(0, 1 - candidate.totalMinutes / options.maxTotalMinutes) * 0.05
        : 0
    const ovenBonus =
      options.ovenProfileId && candidate.ovenProfileId === options.ovenProfileId ? 0.05 : 0

    results.push({
      recipeId: candidate.recipeId,
      coverage: evaluation.coverage,
      missing: evaluation.missing,
      missingRequiredCount: evaluation.missingRequiredCount,
      canCookNow: evaluation.missingRequiredCount === 0,
      // Quality is weighted above coverage on purpose.
      score: qualityScore * 0.55 + evaluation.coverage * 0.35 + timeBonus + ovenBonus,
      reasons,
    })
  }

  results.sort((a, b) => {
    if (a.canCookNow !== b.canCookNow) return a.canCookNow ? -1 : 1
    return b.score - a.score
  })

  return options.limit ? results.slice(0, options.limit) : results
}

interface CoverageResult {
  coverage: number
  missing: MissingIngredient[]
  missingRequiredCount: number
}

/**
 * Expands a recipe and checks it against the pantry.
 *
 * Only numeric, non-optional requirements count toward coverage: "salt to
 * taste" should not drag a score down, and neither should an optional garnish.
 */
export function evaluateCoverage(
  graph: RecipeGraph,
  recipeId: string,
  pantry: readonly PantryEntry[],
): CoverageResult {
  const { lines } = expandRecipe(graph, recipeId, 1)
  const { items } = buildShoppingList(graph, lines, pantry)

  const missing: MissingIngredient[] = []
  let required = 0
  let covered = 0

  for (const item of items) {
    if (!item.required || !isNumeric(item.required)) continue
    if (!item.optional) required += 1

    const short = item.toBuy
    const isCovered = item.fullyCovered
    if (isCovered) {
      if (!item.optional) covered += 1
      continue
    }
    missing.push({
      ingredientId: item.ingredientId,
      required: item.required,
      available: item.available,
      short,
      optional: item.optional,
    })
  }

  return {
    coverage: required === 0 ? 1 : covered / required,
    missing,
    missingRequiredCount: missing.filter((m) => !m.optional).length,
  }
}

/**
 * Substitutions must be curated. A missing ingredient is only ever swapped for
 * something explicitly approved for that style, which is what stops the app
 * from cheerfully proposing ketchup in place of a tomato sauce.
 */
export interface Substitution {
  fromIngredientId: string
  toIngredientId: string
  /** Style this swap is acceptable within; null means "any style". */
  styleId: string | null
  qualityGrade: 'equivalent' | 'good' | 'acceptable' | 'last_resort'
  approved: boolean
  explanationKey: string
}

export function allowedSubstitutions(
  substitutions: readonly Substitution[],
  ingredientId: string,
  styleId: string | null,
): Substitution[] {
  return substitutions.filter(
    (s) =>
      s.approved &&
      s.fromIngredientId === ingredientId &&
      (s.styleId === null || s.styleId === styleId),
  )
}

/** How much of a shortfall remains, for "you need 120 g more mozzarella". */
export function shortfallValue(missing: MissingIngredient): Decimal | null {
  return missing.short ? upperBound(missing.short) : null
}
