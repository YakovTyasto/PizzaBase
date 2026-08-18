import 'server-only'
import { Decimal } from 'decimal.js'
import { type DomainIngredient, type DomainRecipe, type RecipeGraph, graphFrom } from '@/domain'
import { seedCatalog } from '@/lib/seed'
import { seedAmountToDomain } from '@/lib/seed/to-domain'
import type { SeedIngredient, SeedRecipe } from '@/lib/seed/types'
import type { DemoOverlay } from './overlay'

/**
 * The effective catalog: the seed, with the owner's overlay applied on top.
 *
 * A recipe the owner edited shadows its seed original by slug, a recipe they
 * deleted disappears, and one they created is simply added. The seed itself is
 * never mutated, which is what makes "reset demo data" a one-line operation.
 */

export function effectiveRecipes(overlay: DemoOverlay): SeedRecipe[] {
  const deleted = new Set(overlay.deletedRecipeSlugs)
  const overridden = overlay.recipes as Record<string, SeedRecipe>

  const base = seedCatalog.recipes.filter(
    (recipe) => !deleted.has(recipe.slug) && !overridden[recipe.slug],
  )
  const owned = Object.values(overridden).filter((recipe) => !deleted.has(recipe.slug))

  return [...base, ...owned]
}

export function effectiveIngredients(overlay: DemoOverlay): SeedIngredient[] {
  const added = Object.values(overlay.ingredients as Record<string, SeedIngredient>)
  const addedSlugs = new Set(added.map((ingredient) => ingredient.slug))
  return [
    ...seedCatalog.ingredients.filter((ingredient) => !addedSlugs.has(ingredient.slug)),
    ...added,
  ]
}

export function findRecipe(overlay: DemoOverlay, slug: string): SeedRecipe | null {
  if (overlay.deletedRecipeSlugs.includes(slug)) return null
  const overridden = (overlay.recipes as Record<string, SeedRecipe>)[slug]
  if (overridden) return overridden
  return seedCatalog.recipes.find((recipe) => recipe.slug === slug) ?? null
}

/** Projects the effective catalog into the calculation engine's graph. */
export function buildGraph(overlay: DemoOverlay): RecipeGraph {
  const ingredients: DomainIngredient[] = effectiveIngredients(overlay).map((ingredient) => ({
    id: ingredient.slug,
    slug: ingredient.slug,
    measure: ingredient.measure,
    baseUnit: ingredient.baseUnit,
    densityGPerMl: ingredient.densityGPerMl ?? null,
    categoryId: ingredient.categorySlug,
  }))

  const recipes: DomainRecipe[] = effectiveRecipes(overlay).map((recipe) => ({
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
    items: recipe.items.map((item, index) => ({
      id: `${recipe.slug}:${item.key}`,
      ingredientId: item.ingredientSlug ?? null,
      componentRecipeId: item.componentSlug ?? null,
      amount: seedAmountToDomain(item.amount),
      optional: item.optional ?? false,
      group: item.group ?? null,
      sortOrder: index,
      preparationNote: null,
    })),
  }))

  return graphFrom(recipes, ingredients)
}
