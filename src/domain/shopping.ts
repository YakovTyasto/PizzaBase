import { Decimal } from 'decimal.js'
import {
  type Amount,
  addAmounts,
  canCombine,
  convertAmount,
  isNumeric,
  subtractAmount,
  upperBound,
} from './amount'
import { type AggregatedLine, type ExpandedLine, aggregateLines } from './expand'
import { type RecipeGraph, densityOf } from './model'
import type { Unit } from './units'

export interface PantryEntry {
  ingredientId: string
  amount: Amount
}

export interface PackageOption {
  id: string
  ingredientId: string
  /** Net contents of one package. */
  netAmount: Amount
  label: string | null
  preferred: boolean
}

export interface ShoppingLineItem {
  ingredientId: string
  /** What the recipes need in total. */
  required: Amount | null
  /** What the pantry already covers, in `required`'s unit. */
  available: Amount | null
  /** max(required - available, 0). */
  toBuy: Amount | null
  /** Amounts that could not be summed (to taste, unknown, mismatched measures). */
  separate: ExpandedLine[]
  optional: boolean
  packages: PackagePlan | null
  provenance: ExpandedLine[]
  fullyCovered: boolean
}

export interface PackagePlan {
  packageOptionId: string
  label: string | null
  /** Whole packages to buy — you cannot buy 0.4 of a can. */
  count: number
  packageNet: Amount
  /** What will be left over after the cook. */
  leftover: Amount | null
}

export interface ShoppingListResult {
  items: ShoppingLineItem[]
}

/**
 * Builds a consolidated shopping list.
 *
 * Order matters and is fixed: total required first, then pantry deduction in a
 * common unit, then package rounding. Packages are a *presentation* concern —
 * 3 g of yeast stays 3 g in the recipe even though you have to buy a 7 g sachet.
 */
export function buildShoppingList(
  graph: RecipeGraph,
  lines: readonly ExpandedLine[],
  pantry: readonly PantryEntry[] = [],
  packageOptions: readonly PackageOption[] = [],
  options: { includeOptional?: boolean } = {},
): ShoppingListResult {
  const includeOptional = options.includeOptional ?? true
  const aggregated = aggregateLines(graph, lines)
  const pantryByIngredient = foldPantry(graph, pantry)

  const items = aggregated
    .filter((entry) => includeOptional || !entry.optional)
    .map((entry) => buildItem(graph, entry, pantryByIngredient, packageOptions))

  return { items }
}

function foldPantry(
  graph: RecipeGraph,
  pantry: readonly PantryEntry[],
): Map<string, Amount> {
  const map = new Map<string, Amount>()
  for (const entry of pantry) {
    if (!isNumeric(entry.amount)) continue
    const existing = map.get(entry.ingredientId)
    if (!existing) {
      map.set(entry.ingredientId, entry.amount)
      continue
    }
    const density = densityOf(graph, entry.ingredientId)
    if (canCombine(existing, entry.amount, density)) {
      map.set(entry.ingredientId, addAmounts(existing, entry.amount, density))
    }
    // Pantry entries in an incompatible measure (2 jars vs 300 g) are ignored
    // for deduction rather than guessed at; the user can fix the unit.
  }
  return map
}

function buildItem(
  graph: RecipeGraph,
  entry: AggregatedLine,
  pantry: Map<string, Amount>,
  packageOptions: readonly PackageOption[],
): ShoppingLineItem {
  const density = densityOf(graph, entry.ingredientId)
  const required = entry.amount
  const rawAvailable = pantry.get(entry.ingredientId) ?? null

  let available: Amount | null = null
  let toBuy: Amount | null = required

  if (required && isNumeric(required) && rawAvailable && canCombine(required, rawAvailable, density)) {
    available = convertAmount(rawAvailable, required.unit, density)
    toBuy = subtractAmount(required, rawAvailable, density)
  }

  const fullyCovered =
    toBuy !== null && isNumeric(toBuy) && (upperBound(toBuy) ?? new Decimal(1)).isZero()

  return {
    ingredientId: entry.ingredientId,
    required,
    available,
    toBuy,
    separate: entry.separate,
    optional: entry.optional,
    packages:
      toBuy && !fullyCovered
        ? planPackages(toBuy, entry.ingredientId, packageOptions, density)
        : null,
    provenance: entry.sources,
    fullyCovered,
  }
}

/**
 * Chooses a package and computes how many to buy.
 *
 * `packages = ceil(toBuy / packageSize)` — always rounded up, because a half
 * bought can does not exist — and the surplus is surfaced so the user can see
 * they are buying 800 g to use 250 g.
 */
export function planPackages(
  toBuy: Amount,
  ingredientId: string,
  packageOptions: readonly PackageOption[],
  density: string | null,
): PackagePlan | null {
  if (!isNumeric(toBuy)) return null
  const candidates = packageOptions.filter((p) => p.ingredientId === ingredientId)
  if (candidates.length === 0) return null

  const chosen = candidates.find((p) => p.preferred) ?? candidates[0]
  if (!chosen || !isNumeric(chosen.netAmount)) return null

  let net: Amount
  try {
    net = convertAmount(chosen.netAmount, toBuy.unit, density)
  } catch {
    return null
  }
  const netValue = upperBound(net)
  const needed = upperBound(toBuy)
  if (!netValue || !needed || netValue.lessThanOrEqualTo(0)) return null

  const count = needed.dividedBy(netValue).ceil().toNumber()
  const purchased = netValue.times(count)

  return {
    packageOptionId: chosen.id,
    label: chosen.label,
    count,
    packageNet: chosen.netAmount,
    leftover: { kind: 'exact', value: purchased.minus(needed), unit: toBuy.unit },
  }
}

/** Category grouping for the shopping screen ("departments"). */
export function groupByCategory(
  graph: RecipeGraph,
  items: readonly ShoppingLineItem[],
): Map<string, ShoppingLineItem[]> {
  const groups = new Map<string, ShoppingLineItem[]>()
  for (const item of items) {
    const category = graph.ingredient(item.ingredientId)?.categoryId ?? 'uncategorized'
    const bucket = groups.get(category)
    if (bucket) bucket.push(item)
    else groups.set(category, [item])
  }
  return groups
}

/**
 * Rounds an amount for display only. Called at the very end of the pipeline so
 * that accumulated precision is never lost mid-calculation.
 */
export function roundForDisplay(amount: Amount, unit: Unit): Amount {
  if (!isNumeric(amount)) return amount
  const places = unit === 'kg' || unit === 'l' ? 3 : unit === 'g' || unit === 'ml' ? 1 : 2
  return amount.kind === 'exact'
    ? { kind: 'exact', value: amount.value.toDecimalPlaces(places, Decimal.ROUND_HALF_UP), unit: amount.unit }
    : {
        kind: 'range',
        min: amount.min.toDecimalPlaces(places, Decimal.ROUND_HALF_UP),
        max: amount.max.toDecimalPlaces(places, Decimal.ROUND_HALF_UP),
        unit: amount.unit,
      }
}
