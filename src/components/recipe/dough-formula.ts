import type { DoughFormula, DoughRole } from '@/domain'
import type { RecipeDetail } from '@/lib/data/types'

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
 * Builds a formula from a recipe, or returns null when the amounts are not
 * complete enough to compute percentages honestly. A dough whose final-water
 * weight is unknown gets no hydration figure rather than a wrong one.
 */
export function doughFormulaFor(recipe: RecipeDetail): DoughFormula | null {
  if (recipe.type !== 'dough') return null

  const components = recipe.items.flatMap((item) => {
    if (!item.ingredientId) return []
    // Only exact weights can enter a percentage calculation. Ranges and
    // unknowns are exactly the cases the source left unsettled.
    if (item.amount.kind !== 'exact') return []
    if (item.amount.unit !== 'g' && item.amount.unit !== 'kg') return []

    const grams =
      item.amount.unit === 'kg' ? item.amount.value.times(1000) : item.amount.value

    return [
      {
        ingredientId: item.ingredientId,
        role: roleForIngredient(item.ingredientId),
        grams: grams.toString(),
        stage: (item.group === 'poolish' || item.group === 'biga'
          ? 'preferment'
          : 'final') as 'preferment' | 'final',
      },
    ]
  })

  const hasFlour = components.some((c) => c.role === 'flour')
  const hasWater = components.some((c) => c.role === 'water')
  if (!hasFlour || !hasWater) return null

  const preferment = recipe.items.some((i) => i.group === 'poolish')
    ? 'poolish'
    : recipe.items.some((i) => i.group === 'biga')
      ? 'biga'
      : 'none'

  return { preferment, components }
}
