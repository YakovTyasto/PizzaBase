import type { Decimal } from 'decimal.js'
import type { Amount } from './amount'
import type { Measure, Unit } from './units'

export type RecipeType = 'pizza' | 'dough' | 'sauce' | 'prep'
export type RecipeStatus = 'draft' | 'needs_review' | 'verified' | 'archived'

/**
 * How much a recipe can be trusted as a representation of a real style. The AI
 * layer may never assign `traditional` on its own — see `docs`/ARCHITECTURE.md.
 */
export type AuthenticityClass =
  'traditional' | 'pizzaiolo' | 'modern_italian' | 'adapted' | 'experimental' | 'user_verified'

export type Shape = 'round' | 'rectangular'
export type StorageLocation = 'fridge' | 'freezer' | 'pantry'
export type Locale = 'ru' | 'en' | 'fr'

export const LOCALES: readonly Locale[] = ['ru', 'en', 'fr'] as const
export const DEFAULT_LOCALE: Locale = 'ru'

/** The calculation engine's view of an ingredient. */
export interface DomainIngredient {
  id: string
  slug: string
  measure: Measure
  baseUnit: Unit
  /** g per ml, for this specific ingredient only. */
  densityGPerMl: string | null
  categoryId: string | null
}

/** A composition line: exactly one of ingredientId / componentRecipeId is set. */
export interface DomainRecipeItem {
  id: string
  ingredientId: string | null
  componentRecipeId: string | null
  amount: Amount
  optional: boolean
  group: string | null
  sortOrder: number
  preparationNote: string | null
}

export interface DomainRecipe {
  id: string
  slug: string
  type: RecipeType
  status: RecipeStatus
  /** How much one unscaled batch produces, e.g. 400 g of sauce or 3 pizzas. */
  baseYield: Decimal | null
  yieldUnit: Unit | null
  baseDiameterMm: number | null
  baseShape: Shape | null
  baseTrayWidthMm: number | null
  baseTrayHeightMm: number | null
  baseBallWeightG: Decimal | null
  items: DomainRecipeItem[]
}

/** Read-only lookup the pure functions use instead of touching a database. */
export interface RecipeGraph {
  recipe(id: string): DomainRecipe | undefined
  ingredient(id: string): DomainIngredient | undefined
}

export function graphFrom(
  recipes: Iterable<DomainRecipe>,
  ingredients: Iterable<DomainIngredient>,
): RecipeGraph {
  const recipeMap = new Map<string, DomainRecipe>()
  for (const r of recipes) recipeMap.set(r.id, r)
  const ingredientMap = new Map<string, DomainIngredient>()
  for (const i of ingredients) ingredientMap.set(i.id, i)
  return {
    recipe: (id) => recipeMap.get(id),
    ingredient: (id) => ingredientMap.get(id),
  }
}

export function densityOf(graph: RecipeGraph, ingredientId: string): string | null {
  return graph.ingredient(ingredientId)?.densityGPerMl ?? null
}
