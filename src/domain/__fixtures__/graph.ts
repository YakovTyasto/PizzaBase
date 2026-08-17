import { Decimal } from 'decimal.js'
import { type Amount, exact, qualitative, range } from '../amount'
import {
  type DomainIngredient,
  type DomainRecipe,
  type DomainRecipeItem,
  graphFrom,
} from '../model'
import type { Measure, Unit } from '../units'

let counter = 0
const nextId = (prefix: string) => `${prefix}-${++counter}`

export function ing(
  slug: string,
  opts: {
    measure?: Measure
    baseUnit?: Unit
    density?: string | null
    category?: string | null
  } = {},
): DomainIngredient {
  return {
    id: slug,
    slug,
    measure: opts.measure ?? 'mass',
    baseUnit: opts.baseUnit ?? 'g',
    densityGPerMl: opts.density ?? null,
    categoryId: opts.category ?? null,
  }
}

export function item(
  ref: { ingredient?: string; component?: string },
  amount: Amount,
  opts: { optional?: boolean; id?: string } = {},
): DomainRecipeItem {
  return {
    id: opts.id ?? nextId('item'),
    ingredientId: ref.ingredient ?? null,
    componentRecipeId: ref.component ?? null,
    amount,
    optional: opts.optional ?? false,
    group: null,
    sortOrder: 0,
    preparationNote: null,
  }
}

export function recipe(
  slug: string,
  items: DomainRecipeItem[],
  opts: Partial<Omit<DomainRecipe, 'id' | 'slug' | 'items'>> = {},
): DomainRecipe {
  return {
    id: slug,
    slug,
    type: opts.type ?? 'pizza',
    status: opts.status ?? 'draft',
    baseYield: opts.baseYield ?? null,
    yieldUnit: opts.yieldUnit ?? null,
    baseDiameterMm: opts.baseDiameterMm ?? null,
    baseShape: opts.baseShape ?? null,
    baseTrayWidthMm: opts.baseTrayWidthMm ?? null,
    baseTrayHeightMm: opts.baseTrayHeightMm ?? null,
    baseBallWeightG: opts.baseBallWeightG ?? null,
    items,
  }
}

/**
 * A miniature version of the seeded catalog: two pizzas that share a tomato
 * sauce component, so consolidation and provenance can be tested end to end.
 */
export function pizzaFixture() {
  const ingredients = [
    ing('tomatoes', { category: 'canned' }),
    ing('basil', { category: 'herbs' }),
    ing('olive-oil', { density: '0.91', category: 'pantry' }),
    ing('salt', { category: 'pantry' }),
    ing('mozzarella', { category: 'dairy' }),
    ing('parmesan', { category: 'dairy' }),
    ing('pepperoni', { category: 'deli' }),
    ing('garlic', { measure: 'count', baseUnit: 'clove', category: 'produce' }),
  ]

  const sauce = recipe(
    'tomato-sauce',
    [
      item({ ingredient: 'tomatoes' }, exact(400, 'g'), { id: 'sauce-tomatoes' }),
      item({ ingredient: 'basil' }, qualitative('to_taste'), { id: 'sauce-basil' }),
      item({ ingredient: 'olive-oil' }, exact(20, 'ml'), { id: 'sauce-oil' }),
      item({ ingredient: 'salt' }, qualitative('to_taste'), { id: 'sauce-salt' }),
    ],
    { type: 'sauce', baseYield: new Decimal(400), yieldUnit: 'g' },
  )

  const margherita = recipe(
    'margherita',
    [
      item({ component: 'tomato-sauce' }, exact(80, 'g'), { id: 'marg-sauce' }),
      item({ ingredient: 'mozzarella' }, exact(100, 'g'), { id: 'marg-mozza' }),
      item({ ingredient: 'parmesan' }, exact(10, 'g'), { id: 'marg-parm' }),
      item({ ingredient: 'basil' }, qualitative('to_taste'), { id: 'marg-basil' }),
    ],
    { baseYield: new Decimal(1), yieldUnit: 'piece', baseShape: 'round', baseDiameterMm: 300 },
  )

  const pepperoni = recipe(
    'pepperoni',
    [
      item({ component: 'tomato-sauce' }, exact(80, 'g'), { id: 'pep-sauce' }),
      item({ ingredient: 'mozzarella' }, exact(100, 'g'), { id: 'pep-mozza' }),
      item({ ingredient: 'pepperoni' }, exact(60, 'g'), { id: 'pep-pep' }),
    ],
    { baseYield: new Decimal(1), yieldUnit: 'piece', baseShape: 'round', baseDiameterMm: 300 },
  )

  const graph = graphFrom([sauce, margherita, pepperoni], ingredients)
  return { graph, sauce, margherita, pepperoni, ingredients }
}

export { exact, qualitative, range }
