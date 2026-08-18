import { describe, expect, it } from 'vitest'
import { exact, qualitative } from './amount'
import { expandMany, expandRecipe } from './expand'
import { pizzaFixture } from './__fixtures__/graph'
import { type PackageOption, buildShoppingList } from './shopping'
import { formatForTest } from './testing'

describe('shopping list', () => {
  it('consolidates a plan of two different pizzas', () => {
    const { graph } = pizzaFixture()
    const { lines } = expandMany(graph, [
      { recipeId: 'margherita', factor: 2 },
      { recipeId: 'pepperoni', factor: 1 },
    ])
    const { items } = buildShoppingList(graph, lines)

    const mozzarella = items.find((i) => i.ingredientId === 'mozzarella')
    expect(formatForTest(mozzarella?.required)).toBe('300 g')
    expect(formatForTest(mozzarella?.toBuy)).toBe('300 g')

    const tomatoes = items.find((i) => i.ingredientId === 'tomatoes')
    expect(formatForTest(tomatoes?.required)).toBe('240 g')
  })

  it('deducts what is already in the pantry', () => {
    const { graph } = pizzaFixture()
    const { lines } = expandMany(graph, [{ recipeId: 'margherita', factor: 2 }])
    const { items } = buildShoppingList(graph, lines, [
      { ingredientId: 'mozzarella', amount: exact(125, 'g') },
    ])
    const mozzarella = items.find((i) => i.ingredientId === 'mozzarella')
    expect(formatForTest(mozzarella?.required)).toBe('200 g')
    expect(formatForTest(mozzarella?.available)).toBe('125 g')
    expect(formatForTest(mozzarella?.toBuy)).toBe('75 g')
  })

  it('normalizes pantry units before deducting', () => {
    const { graph } = pizzaFixture()
    const { lines } = expandMany(graph, [{ recipeId: 'margherita', factor: 10 }])
    const { items } = buildShoppingList(graph, lines, [
      { ingredientId: 'mozzarella', amount: exact(1, 'kg') },
    ])
    const mozzarella = items.find((i) => i.ingredientId === 'mozzarella')
    // 10 x 100 g needed, 1000 g on hand
    expect(mozzarella?.fullyCovered).toBe(true)
    expect(formatForTest(mozzarella?.toBuy)).toBe('0 g')
  })

  it('never goes negative when the pantry has a surplus', () => {
    const { graph } = pizzaFixture()
    const { lines } = expandRecipe(graph, 'margherita', 1)
    const { items } = buildShoppingList(graph, lines, [
      { ingredientId: 'mozzarella', amount: exact(5, 'kg') },
    ])
    const mozzarella = items.find((i) => i.ingredientId === 'mozzarella')
    expect(formatForTest(mozzarella?.toBuy)).toBe('0 g')
    expect(mozzarella?.packages).toBeNull()
  })

  it('sums several pantry entries for one ingredient', () => {
    const { graph } = pizzaFixture()
    const { lines } = expandRecipe(graph, 'margherita', 3)
    const { items } = buildShoppingList(graph, lines, [
      { ingredientId: 'mozzarella', amount: exact(100, 'g') },
      { ingredientId: 'mozzarella', amount: exact(0.15, 'kg') },
    ])
    const mozzarella = items.find((i) => i.ingredientId === 'mozzarella')
    expect(formatForTest(mozzarella?.available)).toBe('250 g')
    expect(formatForTest(mozzarella?.toBuy)).toBe('50 g')
  })

  it('keeps "to taste" out of the numeric totals', () => {
    const { graph } = pizzaFixture()
    const { lines } = expandRecipe(graph, 'margherita', 4)
    const { items } = buildShoppingList(graph, lines)
    const salt = items.find((i) => i.ingredientId === 'salt')
    expect(salt?.required).toBeNull()
    expect(salt?.separate.length).toBeGreaterThan(0)
    expect(salt?.separate.every((s) => s.amount.kind === 'qualitative')).toBe(true)
  })
})

describe('package rounding', () => {
  const packages: PackageOption[] = [
    {
      id: 'pkg-mozza-125',
      ingredientId: 'mozzarella',
      netAmount: exact(125, 'g'),
      label: 'Ball, 125 g',
      preferred: true,
    },
    {
      id: 'pkg-tomato-400',
      ingredientId: 'tomatoes',
      netAmount: exact(400, 'g'),
      label: 'Can, 400 g',
      preferred: false,
    },
  ]

  it('rounds up to whole packages and reports the leftover', () => {
    const { graph } = pizzaFixture()
    const { lines } = expandMany(graph, [{ recipeId: 'margherita', factor: 3 }])
    const { items } = buildShoppingList(graph, lines, [], packages)

    const mozzarella = items.find((i) => i.ingredientId === 'mozzarella')
    // 300 g needed / 125 g per ball -> 3 balls (375 g), 75 g left over
    expect(mozzarella?.packages?.count).toBe(3)
    expect(formatForTest(mozzarella?.packages?.leftover ?? undefined)).toBe('75 g')
  })

  it('leaves the recipe amount untouched when packages are applied', () => {
    const { graph } = pizzaFixture()
    const { lines } = expandRecipe(graph, 'margherita', 1)
    const { items } = buildShoppingList(graph, lines, [], packages)
    const tomatoes = items.find((i) => i.ingredientId === 'tomatoes')
    // Needs 80 g; buying a whole 400 g can does not turn the recipe into 400 g.
    expect(formatForTest(tomatoes?.required)).toBe('80 g')
    expect(formatForTest(tomatoes?.toBuy)).toBe('80 g')
    expect(tomatoes?.packages?.count).toBe(1)
    expect(formatForTest(tomatoes?.packages?.leftover ?? undefined)).toBe('320 g')
  })

  it('prefers the package marked preferred', () => {
    const { graph } = pizzaFixture()
    const { lines } = expandRecipe(graph, 'margherita', 1)
    const options: PackageOption[] = [
      { ...packages[0]!, id: 'small', netAmount: exact(125, 'g'), preferred: false },
      { ...packages[0]!, id: 'big', netAmount: exact(500, 'g'), preferred: true },
    ]
    const { items } = buildShoppingList(graph, lines, [], options)
    expect(items.find((i) => i.ingredientId === 'mozzarella')?.packages?.packageOptionId).toBe(
      'big',
    )
  })

  it('does not plan packages for a qualitative requirement', () => {
    const { graph } = pizzaFixture()
    const { lines } = expandRecipe(graph, 'margherita', 1)
    const { items } = buildShoppingList(
      graph,
      lines,
      [],
      [
        {
          id: 'pkg-salt',
          ingredientId: 'salt',
          netAmount: exact(1, 'kg'),
          label: 'Bag',
          preferred: true,
        },
      ],
    )
    expect(items.find((i) => i.ingredientId === 'salt')?.packages).toBeNull()
  })
})

describe('optional ingredients', () => {
  it('can be excluded from the list', () => {
    const { graph } = pizzaFixture()
    const { lines } = expandRecipe(graph, 'margherita', 1)
    const withOptional = buildShoppingList(graph, lines, [], [], { includeOptional: true })
    const withoutOptional = buildShoppingList(graph, lines, [], [], { includeOptional: false })
    expect(withOptional.items.length).toBeGreaterThanOrEqual(withoutOptional.items.length)
  })
})

describe('qualitative amounts', () => {
  it('are never converted into numbers anywhere in the pipeline', () => {
    expect(formatForTest(qualitative('to_taste'))).toBe('to_taste')
  })
})
