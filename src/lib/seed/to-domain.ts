import { Decimal } from 'decimal.js'
import {
  type Amount,
  type DomainIngredient,
  type DomainRecipe,
  type DomainRecipeItem,
  type RecipeGraph,
  graphFrom,
} from '@/domain'
import { seedCatalog } from './index'
import type { SeedAmount } from './types'

/** Slugs are the ids in demo mode, which keeps URLs stable and readable. */
export function seedAmountToDomain(amount: SeedAmount): Amount {
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

export interface DomainProjection {
  graph: RecipeGraph
  recipes: DomainRecipe[]
  ingredients: DomainIngredient[]
}

let cached: DomainProjection | null = null

/** Projects the authoring catalog into the shape the calculation engine wants. */
export function toDomainGraph(): DomainProjection {
  if (cached) return cached

  const ingredients: DomainIngredient[] = seedCatalog.ingredients.map((ingredient) => ({
    id: ingredient.slug,
    slug: ingredient.slug,
    measure: ingredient.measure,
    baseUnit: ingredient.baseUnit,
    densityGPerMl: ingredient.densityGPerMl ?? null,
    categoryId: ingredient.categorySlug,
  }))

  const recipes: DomainRecipe[] = seedCatalog.recipes.map((recipe) => {
    const items: DomainRecipeItem[] = recipe.items.map((item, index) => ({
      id: `${recipe.slug}:${item.key}`,
      ingredientId: item.ingredientSlug ?? null,
      componentRecipeId: item.componentSlug ?? null,
      amount: seedAmountToDomain(item.amount),
      optional: item.optional ?? false,
      group: item.group ?? null,
      sortOrder: index,
      preparationNote: null,
    }))

    return {
      id: recipe.slug,
      slug: recipe.slug,
      type: recipe.type,
      status: recipe.status,
      baseYield: recipe.baseYield ? new Decimal(recipe.baseYield) : null,
      yieldUnit: recipe.yieldUnit ?? null,
      baseDiameterMm: recipe.baseDiameterMm ?? null,
      baseShape: recipe.baseShape ?? null,
      baseTrayWidthMm: recipe.baseTrayWidthMm ?? null,
      baseTrayHeightMm: recipe.baseTrayHeightMm ?? null,
      baseBallWeightG: recipe.baseBallWeightG ? new Decimal(recipe.baseBallWeightG) : null,
      items,
    }
  })

  cached = { graph: graphFrom(recipes, ingredients), recipes, ingredients }
  return cached
}

export function resetDomainGraphCache(): void {
  cached = null
}
