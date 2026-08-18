import { Decimal } from 'decimal.js'
import type { Amount, DoughComponent, DoughFormula, DoughRole } from '@/domain'
import type { RecipeDetail, RecipeItemView } from '@/lib/data/types'

/**
 * Maps a dough recipe's ingredient rows onto baker's-percentage roles.
 *
 * The role is inferred from the ingredient slug rather than stored separately,
 * so a recipe stays a plain list of ingredients and the dough maths is derived
 * from it. Anything unrecognised becomes `other`, which contributes to the
 * total dough mass without pretending to be flour or water.
 */
const ROLE_PATTERNS: [RegExp, DoughRole][] = [
  [/^flour-/, 'flour'],
  [/^water$/, 'water'],
  [/^salt-/, 'salt'],
  [/^yeast-/, 'yeast'],
  [/^olive-oil-/, 'oil'],
  [/^honey$/, 'honey'],
  [/^sugar$/, 'sugar'],
  [/starter|levain|sourdough/, 'starter'],
]

export function roleForIngredient(slug: string): DoughRole {
  for (const [pattern, role] of ROLE_PATTERNS) {
    if (pattern.test(slug)) return role
  }
  return 'other'
}

/**
 * Reads a numeric field of an `Amount` as a Decimal.
 *
 * A `RecipeDetail` reaches this component as a prop from a Server Component,
 * and `Decimal` does not survive that crossing as a Decimal: it carries a
 * `toJSON`, so what arrives is the string it produced. Calling a Decimal method
 * on one is therefore a runtime error in the browser and during SSR, however
 * well it typechecks. Going through `toString` works on both sides.
 */
function decimalOf(value: Decimal): Decimal {
  return new Decimal(String(value))
}

/** Grams for a mass amount, or null when the amount is not a weight at all. */
function massInGrams(amount: Amount): { min: string; max: string } | null {
  if (amount.kind !== 'exact' && amount.kind !== 'range') return null
  if (amount.unit !== 'g' && amount.unit !== 'kg') return null

  const toGrams = (value: Decimal) => {
    const decimal = decimalOf(value)
    return (amount.unit === 'kg' ? decimal.times(1000) : decimal).toString()
  }

  if (amount.kind === 'exact') {
    const grams = toGrams(amount.value)
    return { min: grams, max: grams }
  }
  return { min: toGrams(amount.min), max: toGrams(amount.max) }
}

function componentFor(item: RecipeItemView): DoughComponent | null {
  if (!item.ingredientId) return null

  const stage: 'preferment' | 'final' =
    item.group === 'poolish' || item.group === 'biga' ? 'preferment' : 'final'
  const role = roleForIngredient(item.ingredientId)
  const mass = massInGrams(item.amount)

  if (!mass) {
    // Qualitative and unstated weights stay in the formula as unknowns. They
    // contribute no grams, and they are what makes the formula report itself
    // as incomplete instead of quietly under-counting the batch.
    if (item.optional) return null
    return { ingredientId: item.ingredientId, role, grams: 0, unknown: true, stage }
  }

  if (mass.min === mass.max) {
    return { ingredientId: item.ingredientId, role, grams: mass.min, stage }
  }
  // A disputed weight keeps both bounds and takes the midpoint as its nominal
  // reference -- which is what stops "25-30 g of salt" from reading as 0%.
  return {
    ingredientId: item.ingredientId,
    role,
    grams: new Decimal(mass.min).plus(mass.max).dividedBy(2).toString(),
    gramsMin: mass.min,
    gramsMax: mass.max,
    stage,
  }
}

/**
 * Builds a formula from a recipe, or returns null when there is not enough to
 * compute percentages honestly -- which means no flour, or no water at all.
 * Individual amounts the source left unsettled are carried through as unknowns
 * rather than dropped, so the percentages say they are incomplete instead of
 * quietly reporting a wrong number.
 */
export function doughFormulaFor(recipe: RecipeDetail): DoughFormula | null {
  if (recipe.type !== 'dough') return null

  const components = recipe.items.flatMap((item) => {
    const component = componentFor(item)
    return component ? [component] : []
  })

  const hasFlour = components.some((c) => c.role === 'flour' && !c.unknown)
  const hasWater = components.some((c) => c.role === 'water')
  if (!hasFlour || !hasWater) return null

  const preferment = recipe.items.some((i) => i.group === 'poolish')
    ? 'poolish'
    : recipe.items.some((i) => i.group === 'biga')
      ? 'biga'
      : 'none'

  return { preferment, components }
}
