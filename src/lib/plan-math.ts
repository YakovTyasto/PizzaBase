import { Decimal } from 'decimal.js'
import {
  type DomainRecipe,
  type RecipeGraph,
  type ToppingScaleMode,
  doughFactor,
  toppingFactor,
} from '@/domain'
import type { PlanEntry } from '@/lib/data/types'

/**
 * Turns a plan entry into the scale factor the expansion engine needs.
 *
 * Shared by the plan screen, the shopping list and the recommendations, so the
 * three can never disagree about how many pizzas the plan actually represents.
 */
export function factorForEntry(graph: RecipeGraph, entry: PlanEntry): Decimal {
  const recipe = graph.recipe(entry.recipeId)
  if (!recipe) return new Decimal(entry.count)

  const basePizzas = recipe.baseYield?.toNumber() || 1

  if (recipe.type === 'dough') {
    return doughFactor({
      baseRecipe: recipe,
      basePizzaCount: basePizzas,
      targetBallCount: entry.count,
      targetBallWeightG: entry.ballWeightG,
    })
  }

  const baseSize = sizeOf(recipe)
  const targetSize = targetSizeOf(entry, recipe)

  try {
    return toppingFactor({
      mode: entry.scaleMode as ToppingScaleMode,
      basePizzaCount: basePizzas,
      targetPizzaCount: entry.count,
      baseSize,
      targetSize,
    })
  } catch {
    // A recipe with no usable base size still scales by portion count.
    return new Decimal(entry.count).dividedBy(basePizzas)
  }
}

function sizeOf(recipe: DomainRecipe) {
  if (!recipe.baseShape) return null
  return {
    shape: recipe.baseShape,
    diameterMm: recipe.baseDiameterMm,
    trayWidthMm: recipe.baseTrayWidthMm,
    trayHeightMm: recipe.baseTrayHeightMm,
  }
}

function targetSizeOf(entry: PlanEntry, recipe: DomainRecipe) {
  if (!recipe.baseShape) return null
  return {
    shape: entry.shape,
    diameterMm: entry.diameterMm ?? recipe.baseDiameterMm,
    trayWidthMm: entry.trayWidthMm ?? recipe.baseTrayWidthMm,
    trayHeightMm: entry.trayHeightMm ?? recipe.baseTrayHeightMm,
  }
}

export function planRequests(graph: RecipeGraph, entries: readonly PlanEntry[]) {
  return entries.map((entry) => ({
    recipeId: entry.recipeId,
    factor: factorForEntry(graph, entry),
  }))
}
