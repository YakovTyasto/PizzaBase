import { Decimal } from 'decimal.js'
import {
  type Amount,
  type DomainIngredient,
  type DomainRecipe,
  type QualitativeUnit,
  type RecipeGraph,
  type Unit,
  graphFrom,
} from '@/domain'

/**
 * Decimal instances cannot cross the Server/Client Component boundary, so the
 * graph travels as plain strings and is rehydrated on the client. Strings, not
 * numbers: routing a decimal quantity through a JS float on the way to the
 * browser would defeat the point of using decimals at all.
 */

export type WireAmount =
  | { kind: 'exact'; value: string; unit: Unit }
  | { kind: 'range'; min: string; max: string; unit: Unit }
  | { kind: 'qualitative'; unit: QualitativeUnit }
  | { kind: 'unknown' }

export interface WireRecipeItem {
  id: string
  ingredientId: string | null
  componentRecipeId: string | null
  amount: WireAmount
  optional: boolean
  group: string | null
  sortOrder: number
  preparationNote: string | null
}

export interface WireRecipe {
  id: string
  slug: string
  type: DomainRecipe['type']
  status: DomainRecipe['status']
  baseYield: string | null
  yieldUnit: Unit | null
  baseDiameterMm: number | null
  baseShape: DomainRecipe['baseShape']
  baseTrayWidthMm: number | null
  baseTrayHeightMm: number | null
  baseBallWeightG: string | null
  items: WireRecipeItem[]
}

export interface WireGraph {
  recipes: WireRecipe[]
  ingredients: DomainIngredient[]
}

export function serializeAmount(amount: Amount): WireAmount {
  switch (amount.kind) {
    case 'exact':
      return { kind: 'exact', value: amount.value.toString(), unit: amount.unit }
    case 'range':
      return {
        kind: 'range',
        min: amount.min.toString(),
        max: amount.max.toString(),
        unit: amount.unit,
      }
    case 'qualitative':
      return { kind: 'qualitative', unit: amount.unit }
    case 'unknown':
      return { kind: 'unknown' }
  }
}

export function deserializeAmount(amount: WireAmount): Amount {
  switch (amount.kind) {
    case 'exact':
      return { kind: 'exact', value: new Decimal(amount.value), unit: amount.unit }
    case 'range':
      return {
        kind: 'range',
        min: new Decimal(amount.min),
        max: new Decimal(amount.max),
        unit: amount.unit,
      }
    case 'qualitative':
      return { kind: 'qualitative', unit: amount.unit }
    case 'unknown':
      return { kind: 'unknown' }
  }
}

export function serializeRecipe(recipe: DomainRecipe): WireRecipe {
  return {
    id: recipe.id,
    slug: recipe.slug,
    type: recipe.type,
    status: recipe.status,
    baseYield: recipe.baseYield?.toString() ?? null,
    yieldUnit: recipe.yieldUnit,
    baseDiameterMm: recipe.baseDiameterMm,
    baseShape: recipe.baseShape,
    baseTrayWidthMm: recipe.baseTrayWidthMm,
    baseTrayHeightMm: recipe.baseTrayHeightMm,
    baseBallWeightG: recipe.baseBallWeightG?.toString() ?? null,
    items: recipe.items.map((item) => ({
      id: item.id,
      ingredientId: item.ingredientId,
      componentRecipeId: item.componentRecipeId,
      amount: serializeAmount(item.amount),
      optional: item.optional,
      group: item.group,
      sortOrder: item.sortOrder,
      preparationNote: item.preparationNote,
    })),
  }
}

export function deserializeRecipe(recipe: WireRecipe): DomainRecipe {
  return {
    id: recipe.id,
    slug: recipe.slug,
    type: recipe.type,
    status: recipe.status,
    baseYield: recipe.baseYield === null ? null : new Decimal(recipe.baseYield),
    yieldUnit: recipe.yieldUnit,
    baseDiameterMm: recipe.baseDiameterMm,
    baseShape: recipe.baseShape,
    baseTrayWidthMm: recipe.baseTrayWidthMm,
    baseTrayHeightMm: recipe.baseTrayHeightMm,
    baseBallWeightG: recipe.baseBallWeightG === null ? null : new Decimal(recipe.baseBallWeightG),
    items: recipe.items.map((item) => ({
      ...item,
      amount: deserializeAmount(item.amount),
    })),
  }
}

export function deserializeGraph(wire: WireGraph): RecipeGraph {
  return graphFrom(wire.recipes.map(deserializeRecipe), wire.ingredients)
}

/**
 * Collects a recipe and everything reachable from it, so the client receives a
 * graph that can be fully expanded without another round trip.
 */
export function collectSubgraph(graph: RecipeGraph, rootId: string): DomainRecipe[] {
  const seen = new Set<string>()
  const out: DomainRecipe[] = []

  const walk = (id: string) => {
    if (seen.has(id)) return
    seen.add(id)
    const recipe = graph.recipe(id)
    if (!recipe) return
    out.push(recipe)
    for (const item of recipe.items) {
      if (item.componentRecipeId) walk(item.componentRecipeId)
    }
  }

  walk(rootId)
  return out
}

export function serializeGraphFor(
  graph: RecipeGraph,
  rootIds: readonly string[],
  ingredients: DomainIngredient[],
): WireGraph {
  const recipes = new Map<string, DomainRecipe>()
  for (const rootId of rootIds) {
    for (const recipe of collectSubgraph(graph, rootId)) recipes.set(recipe.id, recipe)
  }
  return {
    recipes: [...recipes.values()].map(serializeRecipe),
    ingredients,
  }
}
