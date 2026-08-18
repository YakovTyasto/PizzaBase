import { Decimal } from 'decimal.js'
import { type Amount, isNumeric, upperBound } from './amount'
import { type ExpansionIssue, RecipeCycleError, expandRecipe } from './expand'
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

/** An ingredient with no quantity the pantry can be checked against. */
export interface UnknownRequirement {
  ingredientId: string
  optional: boolean
  /** `qualitative` covers "to taste"; `unknown` is a genuinely unstated amount. */
  reason: 'unknown' | 'qualitative'
}

export interface Recommendation {
  recipeId: string
  /** 0..1 share of required (non-optional, numeric) ingredients fully covered. */
  coverage: number
  missing: MissingIngredient[]
  missingRequiredCount: number
  /** Mandatory ingredients whose amount the recipe never states -- blocking. */
  unknownRequired: UnknownRequirement[]
  /**
   * Quantities that cannot be checked but never block: optional unstated
   * amounts, and mandatory "to taste" lines, which are instructions rather
   * than measurements. Shown separately so the gap is still visible.
   */
  unknownOptional: UnknownRequirement[]
  /**
   * False when something mandatory is unknown or the recipe could not be fully
   * expanded. `canCookNow` is never true while this is false.
   */
  dataComplete: boolean
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
  | { kind: 'data_incomplete' }

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
 * How much a recipe's own review state is worth.
 *
 * A verified recipe whose quantities all add up should outrank a draft that
 * happens to look cheap only because half its amounts are missing -- which is
 * exactly what an unweighted score would do.
 */
const STATUS_WEIGHT: Record<RecipeStatus, number> = {
  verified: 1,
  needs_review: 0.75,
  draft: 0.55,
  archived: 0.2,
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
    if (!evaluation.dataComplete) reasons.push({ kind: 'data_incomplete' })

    const qualityScore =
      AUTHENTICITY_WEIGHT[candidate.authenticity] * 0.4 +
      STATUS_WEIGHT[candidate.status] * 0.25 +
      Math.min(candidate.sourceCredibility, 1) * 0.35

    const timeBonus =
      candidate.totalMinutes && options.maxTotalMinutes
        ? Math.max(0, 1 - candidate.totalMinutes / options.maxTotalMinutes) * 0.05
        : 0
    const ovenBonus =
      options.ovenProfileId && candidate.ovenProfileId === options.ovenProfileId ? 0.05 : 0
    // A recipe the app cannot finish the arithmetic for is a worse suggestion
    // than one it can, whatever its provenance says.
    const completenessPenalty = evaluation.dataComplete ? 0 : 0.35

    results.push({
      recipeId: candidate.recipeId,
      coverage: evaluation.coverage,
      missing: evaluation.missing,
      missingRequiredCount: evaluation.missingRequiredCount,
      unknownRequired: evaluation.unknownRequired,
      unknownOptional: evaluation.unknownOptional,
      dataComplete: evaluation.dataComplete,
      // Cookable means every mandatory ingredient is both known and covered.
      canCookNow:
        evaluation.dataComplete &&
        evaluation.requiredCount > 0 &&
        evaluation.missingRequiredCount === 0,
      // Quality is weighted above coverage on purpose.
      score: Math.max(
        0,
        qualityScore * 0.55 +
          evaluation.coverage * 0.35 +
          timeBonus +
          ovenBonus -
          completenessPenalty,
      ),
      reasons,
    })
  }

  results.sort((a, b) => {
    if (a.canCookNow !== b.canCookNow) return a.canCookNow ? -1 : 1
    // Calculable recipes come before ones whose data is too thin to check,
    // regardless of how well-sourced the incomplete one claims to be.
    if (a.dataComplete !== b.dataComplete) return a.dataComplete ? -1 : 1
    return b.score - a.score
  })

  return options.limit ? results.slice(0, options.limit) : results
}

export interface CoverageResult {
  /** 0..1 over the mandatory requirements that carry a usable number. */
  coverage: number
  /** How many mandatory requirements the ratio was taken over. */
  requiredCount: number
  missing: MissingIngredient[]
  missingRequiredCount: number
  /** Mandatory amounts the recipe never states -- these block cooking. */
  unknownRequired: UnknownRequirement[]
  /** Uncheckable but non-blocking: optional unknowns and "to taste" lines. */
  unknownOptional: UnknownRequirement[]
  /** Expansion problems, e.g. a component whose yield is unknown. */
  issues: ExpansionIssue[]
  dataComplete: boolean
}

/**
 * Expands a recipe and checks it against the pantry.
 *
 * Three states, deliberately kept apart. A numeric requirement is either
 * covered or short. A *qualitative* one ("salt to taste") is not a quantity at
 * all and never drags the score down. An *unknown* one is a gap in the recipe:
 * it makes coverage indeterminate rather than complete, because a recipe that
 * does not say how much oil it needs cannot honestly be reported as one you
 * have everything for.
 *
 * A recipe with nothing numeric to check gets a coverage of zero, not one. The
 * old behaviour -- an empty denominator meaning "100% covered" -- is exactly
 * how a recipe with no usable amounts came to be offered as cookable.
 */
export function evaluateCoverage(
  graph: RecipeGraph,
  recipeId: string,
  pantry: readonly PantryEntry[],
): CoverageResult {
  const { lines, issues } = expandRecipe(graph, recipeId, 1)
  const { items } = buildShoppingList(graph, lines, pantry)

  const missing: MissingIngredient[] = []
  const unknownRequired: UnknownRequirement[] = []
  const unknownOptional: UnknownRequirement[] = []
  let required = 0
  let covered = 0

  for (const item of items) {
    // Lines the aggregation could not fold into a number: "to taste" is a
    // documented instruction, an unstated amount is a hole in the recipe.
    const unknownLines = item.separate.filter((line) => line.amount.kind === 'unknown')
    const blocking = !item.optional && unknownLines.some((line) => !line.optional)

    for (const line of unknownLines) {
      const entry: UnknownRequirement = {
        ingredientId: item.ingredientId,
        optional: line.optional,
        reason: 'unknown',
      }
      if (line.optional) unknownOptional.push(entry)
      else unknownRequired.push(entry)
    }

    if (blocking) {
      // Counted as a requirement and never as a covered one: the pantry cannot
      // answer "do I have enough?" when the recipe never said how much.
      required += 1
      continue
    }

    if (!item.required || !isNumeric(item.required)) {
      if (!item.optional && unknownLines.length === 0) {
        // Everything about this ingredient was qualitative. It is still needed,
        // but there is no quantity to compare against the pantry, so it neither
        // counts toward coverage nor stands in the way of cooking.
        unknownOptional.push({
          ingredientId: item.ingredientId,
          optional: false,
          reason: 'qualitative',
        })
      }
      continue
    }
    if (!item.optional) required += 1

    if (item.fullyCovered) {
      if (!item.optional) covered += 1
      continue
    }
    missing.push({
      ingredientId: item.ingredientId,
      required: item.required,
      available: item.available,
      short: item.toBuy,
      optional: item.optional,
    })
  }

  // An expansion issue means a whole branch of the recipe never made it into
  // the comparison at all, so the answer cannot be called complete either.
  const dataComplete = unknownRequired.length === 0 && issues.length === 0 && required > 0

  return {
    coverage: required === 0 ? 0 : covered / required,
    requiredCount: required,
    missing,
    missingRequiredCount: missing.filter((m) => !m.optional).length,
    unknownRequired,
    unknownOptional,
    issues,
    dataComplete,
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
