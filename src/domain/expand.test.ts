import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { type Amount, exact, qualitative } from './amount'
import { exactAmountOf } from './testing'
import { RecipeCycleError, aggregateLines, expandMany, expandRecipe } from './expand'
import { item, pizzaFixture, recipe } from './__fixtures__/graph'
import { graphFrom, type DomainIngredient } from './model'
import { ing } from './__fixtures__/graph'

describe('nested recipe expansion', () => {
  it('expands a pizza through its sauce down to raw ingredients', () => {
    const { graph } = pizzaFixture()
    const { lines, issues } = expandRecipe(graph, 'margherita', 1)
    expect(issues).toEqual([])

    // 80 g of a sauce that yields 400 g => one fifth of the sauce batch.
    const tomatoes = lines.find((l) => l.ingredientId === 'tomatoes')
    expect(exactAmountOf(tomatoes?.amount)).toBe('80')

    const oil = lines.find((l) => l.ingredientId === 'olive-oil')
    expect(exactAmountOf(oil?.amount)).toBe('4')
  })

  it('records a root-first provenance chain', () => {
    const { graph } = pizzaFixture()
    const { lines } = expandRecipe(graph, 'margherita', 1)
    const tomatoes = lines.find((l) => l.ingredientId === 'tomatoes')
    expect(tomatoes?.provenance.map((p) => p.recipeSlug)).toEqual(['margherita', 'tomato-sauce'])
  })

  it('carries qualitative component ingredients through untouched', () => {
    const { graph } = pizzaFixture()
    const { lines } = expandRecipe(graph, 'margherita', 4)
    const salt = lines.find((l) => l.ingredientId === 'salt')
    expect(salt?.amount.kind).toBe('qualitative')
  })

  it('scales the whole tree by the requested factor', () => {
    const { graph } = pizzaFixture()
    const { lines } = expandRecipe(graph, 'margherita', 4)
    expect(exactAmountOf(lines.find((l) => l.ingredientId === 'tomatoes')?.amount)).toBe('320')
    expect(exactAmountOf(lines.find((l) => l.ingredientId === 'mozzarella')?.amount)).toBe('400')
  })

  it('rejects a cycle instead of recursing forever', () => {
    const a = recipe('sauce-a', [item({ component: 'sauce-b' }, exact(10, 'g'))], {
      baseYield: new Decimal(100),
      yieldUnit: 'g',
    })
    const b = recipe('sauce-b', [item({ component: 'sauce-a' }, exact(10, 'g'))], {
      baseYield: new Decimal(100),
      yieldUnit: 'g',
    })
    const graph = graphFrom([a, b], [])
    expect(() => expandRecipe(graph, 'sauce-a', 1)).toThrow(RecipeCycleError)
  })

  it('rejects a recipe that contains itself', () => {
    const self = recipe('loop', [item({ component: 'loop' }, exact(10, 'g'))], {
      baseYield: new Decimal(100),
      yieldUnit: 'g',
    })
    const graph = graphFrom([self], [])
    expect(() => expandRecipe(graph, 'loop', 1)).toThrow(/cycle/i)
  })

  it('reports an issue instead of inventing a factor when a yield is unknown', () => {
    const mystery = recipe('mystery-sauce', [item({ ingredient: 'salt' }, exact(5, 'g'))], {
      type: 'sauce',
    })
    const pizza = recipe('odd-pizza', [item({ component: 'mystery-sauce' }, exact(80, 'g'))])
    const graph = graphFrom([mystery, pizza], [ing('salt')])
    const { lines, issues } = expandRecipe(graph, 'odd-pizza', 1)
    expect(lines).toHaveLength(0)
    expect(issues[0]?.code).toBe('component_yield_unknown')
  })

  it('reports an issue when the component amount is not numeric', () => {
    const { graph, margherita } = pizzaFixture()
    const vague = recipe('vague-pizza', [
      item({ component: 'tomato-sauce' }, qualitative('as_needed')),
    ])
    const graph2 = graphFrom(
      [vague, ...['tomato-sauce'].map((id) => graph.recipe(id)!), margherita],
      [ing('tomatoes'), ing('basil'), ing('olive-oil'), ing('salt')],
    )
    const { issues } = expandRecipe(graph2, 'vague-pizza', 1)
    expect(issues[0]?.code).toBe('component_amount_not_numeric')
  })
})

describe('aggregation across several pizzas', () => {
  it('consolidates 2 Margherita + 1 Pepperoni and keeps provenance', () => {
    const { graph } = pizzaFixture()
    const { lines } = expandMany(graph, [
      { recipeId: 'margherita', factor: 2 },
      { recipeId: 'pepperoni', factor: 1 },
    ])
    const aggregated = aggregateLines(graph, lines)

    const mozzarella = aggregated.find((a) => a.ingredientId === 'mozzarella')
    // 2 x 100 g + 1 x 100 g
    expect(exactAmountOf(mozzarella?.amount ?? undefined)).toBe('300')

    const tomatoes = aggregated.find((a) => a.ingredientId === 'tomatoes')
    // 3 pizzas x 80 g of sauce, each 80 g of sauce carrying 80 g of tomatoes
    expect(exactAmountOf(tomatoes?.amount ?? undefined)).toBe('240')
    // Provenance survives consolidation: one contribution per source recipe
    // (the two Margheritas are a single scaled line).
    expect(tomatoes?.sources).toHaveLength(2)
    expect(tomatoes?.sources.every((s) => s.provenance.at(-1)?.recipeSlug === 'tomato-sauce')).toBe(
      true,
    )
  })

  it('merges by ingredient id, not display name', () => {
    const ingredients: DomainIngredient[] = [
      ing('mozzarella-fior-di-latte'),
      ing('mozzarella-di-bufala'),
    ]
    const r = recipe('two-mozzas', [
      item({ ingredient: 'mozzarella-fior-di-latte' }, exact(100, 'g')),
      item({ ingredient: 'mozzarella-di-bufala' }, exact(80, 'g')),
    ])
    const graph = graphFrom([r], ingredients)
    const aggregated = aggregateLines(graph, expandRecipe(graph, 'two-mozzas', 1).lines)
    expect(aggregated).toHaveLength(2)
  })

  it('keeps qualitative lines beside the numeric total', () => {
    const { graph } = pizzaFixture()
    const { lines } = expandRecipe(graph, 'margherita', 1)
    const aggregated = aggregateLines(graph, lines)
    const basil = aggregated.find((a) => a.ingredientId === 'basil')
    expect(basil?.amount).toBeNull()
    expect(basil?.separate).toHaveLength(2)
  })

  it('does not fuse incompatible measures for one ingredient', () => {
    const r = recipe('mixed', [
      item({ ingredient: 'garlic' }, exact(2, 'clove')),
      item({ ingredient: 'garlic' }, exact(5, 'g')),
    ])
    const graph = graphFrom([r], [ing('garlic', { measure: 'count', baseUnit: 'clove' })])
    const aggregated = aggregateLines(graph, expandRecipe(graph, 'mixed', 1).lines)
    const garlic = aggregated.find((a) => a.ingredientId === 'garlic')
    expect(exactAmountOf(garlic?.amount ?? undefined)).toBe('2')
    expect(garlic?.separate).toHaveLength(1)
  })

  it('marks an ingredient optional only when every contribution is optional', () => {
    const r = recipe('opt', [
      item({ ingredient: 'basil' }, exact(5, 'g'), { optional: true }),
      item({ ingredient: 'basil' }, exact(5, 'g'), { optional: false }),
      item({ ingredient: 'parmesan' }, exact(5, 'g'), { optional: true }),
    ])
    const graph = graphFrom([r], [ing('basil'), ing('parmesan')])
    const aggregated = aggregateLines(graph, expandRecipe(graph, 'opt', 1).lines)
    expect(aggregated.find((a) => a.ingredientId === 'basil')?.optional).toBe(false)
    expect(aggregated.find((a) => a.ingredientId === 'parmesan')?.optional).toBe(true)
  })
})

describe('amount helper', () => {
  it('reads exact values', () => {
    const a: Amount = exact(5, 'g')
    expect(exactAmountOf(a)).toBe('5')
  })
})
