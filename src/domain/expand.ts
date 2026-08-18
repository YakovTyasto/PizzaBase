import { Decimal } from 'decimal.js'
import {
  type Amount,
  addAmounts,
  canCombine,
  convertAmount,
  isNumeric,
  scaleAmount,
  upperBound,
} from './amount'
import { type DomainRecipe, type RecipeGraph, densityOf } from './model'
import { areConvertible } from './units'

/** One hop in the "why is this in my basket" chain. */
export interface ProvenanceStep {
  recipeId: string
  recipeSlug: string
  itemId: string
}

export interface ExpandedLine {
  ingredientId: string
  amount: Amount
  optional: boolean
  /** Root-first: [Margherita, tomato sauce] for a tomato inside the sauce. */
  provenance: ProvenanceStep[]
  preparationNote: string | null
}

export type ExpansionIssueCode =
  | 'component_yield_unknown'
  | 'component_amount_not_numeric'
  | 'component_unit_incompatible'
  | 'component_missing'
  | 'ingredient_missing'

export interface ExpansionIssue {
  code: ExpansionIssueCode
  recipeId: string
  itemId: string
  message: string
}

export interface ExpansionResult {
  lines: ExpandedLine[]
  issues: ExpansionIssue[]
}

export class RecipeCycleError extends Error {
  constructor(readonly path: string[]) {
    super(`Recipe cycle detected: ${path.join(' -> ')}`)
    this.name = 'RecipeCycleError'
  }
}

/**
 * Expands a recipe into leaf ingredient lines.
 *
 * A component contributes `requestedAmount / componentBaseYield` of its own
 * batch, so a pizza asking for 80 g of a sauce whose base batch yields 400 g
 * pulls in one fifth of that sauce's ingredients.
 *
 * Component expansion is memoized at factor 1 and multiplied afterwards, which
 * keeps a plan with a dozen pizzas sharing one dough from re-walking the tree.
 */
export function expandRecipe(
  graph: RecipeGraph,
  recipeId: string,
  factor: Decimal.Value = 1,
): ExpansionResult {
  const memo = new Map<string, ExpansionResult>()
  const base = expandUnit(graph, recipeId, [], memo)
  const f = new Decimal(factor)
  return {
    lines: base.lines.map((line) => ({ ...line, amount: scaleAmount(line.amount, f) })),
    issues: dedupeIssues(base.issues),
  }
}

/** A memoized component reports its issues once per reuse; collapse them. */
function dedupeIssues(issues: readonly ExpansionIssue[]): ExpansionIssue[] {
  const seen = new Set<string>()
  const out: ExpansionIssue[] = []
  for (const issue of issues) {
    const key = `${issue.code}|${issue.recipeId}|${issue.itemId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(issue)
  }
  return out
}

/** Expands exactly one batch of `recipeId`. Results are memoized per call tree. */
function expandUnit(
  graph: RecipeGraph,
  recipeId: string,
  stack: string[],
  memo: Map<string, ExpansionResult>,
): ExpansionResult {
  if (stack.includes(recipeId)) {
    throw new RecipeCycleError([...stack, recipeId])
  }
  const cached = memo.get(recipeId)
  if (cached) return cached

  const recipe = graph.recipe(recipeId)
  if (!recipe) {
    return { lines: [], issues: [] }
  }

  const lines: ExpandedLine[] = []
  const issues: ExpansionIssue[] = []
  const nextStack = [...stack, recipeId]

  for (const item of recipe.items) {
    const step: ProvenanceStep = {
      recipeId: recipe.id,
      recipeSlug: recipe.slug,
      itemId: item.id,
    }

    if (item.ingredientId) {
      if (!graph.ingredient(item.ingredientId)) {
        issues.push({
          code: 'ingredient_missing',
          recipeId: recipe.id,
          itemId: item.id,
          message: `Ingredient ${item.ingredientId} is not in the catalog`,
        })
        continue
      }
      lines.push({
        ingredientId: item.ingredientId,
        amount: item.amount,
        optional: item.optional,
        provenance: [step],
        preparationNote: item.preparationNote,
      })
      continue
    }

    if (!item.componentRecipeId) continue

    const component = graph.recipe(item.componentRecipeId)
    if (!component) {
      issues.push({
        code: 'component_missing',
        recipeId: recipe.id,
        itemId: item.id,
        message: `Component recipe ${item.componentRecipeId} was not found`,
      })
      continue
    }

    const subFactor = componentFactor(recipe, component, item.amount)
    if (!subFactor.ok) {
      issues.push({
        code: subFactor.code,
        recipeId: recipe.id,
        itemId: item.id,
        message: subFactor.message,
      })
      continue
    }

    const inner = expandUnit(graph, component.id, nextStack, memo)
    issues.push(...inner.issues)
    for (const line of inner.lines) {
      lines.push({
        ...line,
        amount: scaleAmount(line.amount, subFactor.factor),
        // Root-first chain: this recipe, then the path inside the component.
        provenance: [step, ...line.provenance],
        optional: line.optional || item.optional,
      })
    }
  }

  const result = { lines, issues }
  // Safe to memoize: an entry only lands here after its whole subtree expanded
  // without throwing, so anything already in the map is known to be cycle-free.
  memo.set(recipeId, result)
  return result
}

type FactorResult =
  { ok: true; factor: Decimal } | { ok: false; code: ExpansionIssueCode; message: string }

function componentFactor(
  parent: DomainRecipe,
  component: DomainRecipe,
  requested: Amount,
): FactorResult {
  if (component.baseYield === null || component.yieldUnit === null) {
    return {
      ok: false,
      code: 'component_yield_unknown',
      message: `${component.slug} has no base yield, so ${parent.slug} cannot be broken down into its ingredients`,
    }
  }
  if (component.baseYield.isZero()) {
    return {
      ok: false,
      code: 'component_yield_unknown',
      message: `${component.slug} has a base yield of zero`,
    }
  }
  if (!isNumeric(requested)) {
    return {
      ok: false,
      code: 'component_amount_not_numeric',
      message: `${parent.slug} does not state how much ${component.slug} it uses`,
    }
  }
  if (!areConvertible(requested.unit, component.yieldUnit)) {
    return {
      ok: false,
      code: 'component_unit_incompatible',
      message: `${parent.slug} asks for ${requested.unit} of ${component.slug}, which yields ${component.yieldUnit}`,
    }
  }
  const converted = convertAmount(requested, component.yieldUnit)
  const value = upperBound(converted)
  if (value === null) {
    return {
      ok: false,
      code: 'component_amount_not_numeric',
      message: `${parent.slug} does not state how much ${component.slug} it uses`,
    }
  }
  return { ok: true, factor: value.dividedBy(component.baseYield) }
}

export interface AggregatedLine {
  ingredientId: string
  /** Combined numeric total, or null when only qualitative/unknown lines exist. */
  amount: Amount | null
  /** Lines that could not be folded into `amount` (to taste, unknown, …). */
  separate: ExpandedLine[]
  optional: boolean
  sources: ExpandedLine[]
}

/**
 * Folds expanded lines into one row per ingredient.
 *
 * Identity comes from `ingredientId`, never a display name, so "Parmesan" and
 * "Parmigiano Reggiano" merge only when they are genuinely the same catalog
 * entry. Qualitative and unknown amounts are kept beside the total instead of
 * being invented into numbers, and an ingredient stays optional only when every
 * line contributing to it was optional.
 */
export function aggregateLines(
  graph: RecipeGraph,
  lines: readonly ExpandedLine[],
): AggregatedLine[] {
  const byIngredient = new Map<string, AggregatedLine>()

  for (const line of lines) {
    let entry = byIngredient.get(line.ingredientId)
    if (!entry) {
      entry = {
        ingredientId: line.ingredientId,
        amount: null,
        separate: [],
        optional: true,
        sources: [],
      }
      byIngredient.set(line.ingredientId, entry)
    }
    entry.sources.push(line)
    if (!line.optional) entry.optional = false

    if (!isNumeric(line.amount)) {
      entry.separate.push(line)
      continue
    }
    if (entry.amount === null) {
      entry.amount = line.amount
      continue
    }
    const density = densityOf(graph, line.ingredientId)
    if (canCombine(entry.amount, line.amount, density)) {
      entry.amount = addAmounts(entry.amount, line.amount, density)
    } else {
      // Incompatible measures (e.g. 2 pieces vs 50 g) stay side by side rather
      // than being fused with a made-up conversion.
      entry.separate.push(line)
    }
  }

  return [...byIngredient.values()]
}

/** Convenience: expand and aggregate several recipes at once (a meal plan). */
export function expandMany(
  graph: RecipeGraph,
  requests: readonly { recipeId: string; factor: Decimal.Value }[],
): ExpansionResult {
  const lines: ExpandedLine[] = []
  const issues: ExpansionIssue[] = []
  for (const request of requests) {
    const result = expandRecipe(graph, request.recipeId, request.factor)
    lines.push(...result.lines)
    issues.push(...result.issues)
  }
  return { lines, issues }
}
