import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { exact } from './amount'
import { ing, item, pizzaFixture, recipe } from './__fixtures__/graph'
import { graphFrom } from './model'
import {
  type RecommendationCandidate,
  type Substitution,
  allowedSubstitutions,
  evaluateCoverage,
  recommend,
} from './recommend'
import type { PantryEntry } from './shopping'

const candidates: RecommendationCandidate[] = [
  {
    recipeId: 'margherita',
    authenticity: 'traditional',
    status: 'verified',
    styleId: 'napoletana',
    sourceCredibility: 1,
    totalMinutes: 90,
    ovenProfileId: 'home-oven',
  },
  {
    recipeId: 'pepperoni',
    authenticity: 'modern_italian',
    status: 'verified',
    styleId: 'napoletana',
    sourceCredibility: 0.5,
    totalMinutes: 90,
    ovenProfileId: 'home-oven',
  },
]

describe('pantry coverage', () => {
  it('reports full coverage when everything is on hand', () => {
    const { graph } = pizzaFixture()
    const pantry: PantryEntry[] = [
      { ingredientId: 'mozzarella', amount: exact(500, 'g') },
      { ingredientId: 'parmesan', amount: exact(200, 'g') },
      { ingredientId: 'tomatoes', amount: exact(800, 'g') },
      { ingredientId: 'olive-oil', amount: exact(500, 'ml') },
    ]
    const result = evaluateCoverage(graph, 'margherita', pantry)
    expect(result.coverage).toBe(1)
    expect(result.missingRequiredCount).toBe(0)
  })

  it('lists exactly what is short and by how much', () => {
    const { graph } = pizzaFixture()
    const result = evaluateCoverage(graph, 'margherita', [
      { ingredientId: 'mozzarella', amount: exact(40, 'g') },
    ])
    const mozzarella = result.missing.find((m) => m.ingredientId === 'mozzarella')
    expect(mozzarella?.short?.kind).toBe('exact')
    expect(mozzarella?.short && mozzarella.short.kind === 'exact' && mozzarella.short.value.toString()).toBe('60')
  })

  it('does not count "to taste" ingredients against coverage', () => {
    const { graph } = pizzaFixture()
    const result = evaluateCoverage(graph, 'margherita', [
      { ingredientId: 'mozzarella', amount: exact(500, 'g') },
      { ingredientId: 'parmesan', amount: exact(200, 'g') },
      { ingredientId: 'tomatoes', amount: exact(800, 'g') },
      { ingredientId: 'olive-oil', amount: exact(500, 'ml') },
    ])
    // Basil and salt are qualitative and must not appear as missing.
    expect(result.missing.map((m) => m.ingredientId)).not.toContain('salt')
    expect(result.coverage).toBe(1)
  })
})

describe('recommendation ranking', () => {
  const fullPantry: PantryEntry[] = [
    { ingredientId: 'mozzarella', amount: exact(1, 'kg') },
    { ingredientId: 'parmesan', amount: exact(200, 'g') },
    { ingredientId: 'tomatoes', amount: exact(2, 'kg') },
    { ingredientId: 'olive-oil', amount: exact(500, 'ml') },
    { ingredientId: 'pepperoni', amount: exact(200, 'g') },
  ]

  it('puts cookable recipes first', () => {
    const { graph } = pizzaFixture()
    const results = recommend(graph, candidates, [
      { ingredientId: 'pepperoni', amount: exact(200, 'g') },
      { ingredientId: 'mozzarella', amount: exact(1, 'kg') },
      { ingredientId: 'tomatoes', amount: exact(2, 'kg') },
      { ingredientId: 'olive-oil', amount: exact(500, 'ml') },
    ])
    // Pepperoni is fully covered; Margherita is short on parmesan.
    expect(results[0]?.recipeId).toBe('pepperoni')
    expect(results[0]?.canCookNow).toBe(true)
    expect(results[1]?.canCookNow).toBe(false)
  })

  it('prefers the better-sourced recipe when both are cookable', () => {
    const { graph } = pizzaFixture()
    const results = recommend(graph, candidates, fullPantry)
    expect(results.every((r) => r.canCookNow)).toBe(true)
    // Both cookable, so quality decides: traditional + credibility 1 wins.
    expect(results[0]?.recipeId).toBe('margherita')
  })

  it('excludes experimental recipes unless explicitly asked', () => {
    const { graph } = pizzaFixture()
    const experimental: RecommendationCandidate[] = [
      { ...candidates[0]!, recipeId: 'pepperoni', authenticity: 'experimental' },
    ]
    expect(recommend(graph, experimental, fullPantry)).toHaveLength(0)
    expect(
      recommend(graph, experimental, fullPantry, { includeExperimental: true }),
    ).toHaveLength(1)
  })

  it('explains why each recipe was suggested', () => {
    const { graph } = pizzaFixture()
    const results = recommend(graph, candidates, fullPantry, { ovenProfileId: 'home-oven' })
    const kinds = results[0]!.reasons.map((r) => r.kind)
    expect(kinds).toContain('coverage')
    expect(kinds).toContain('authenticity')
    expect(kinds).toContain('oven_match')
  })

  it('honours a time budget', () => {
    const { graph } = pizzaFixture()
    const slow: RecommendationCandidate[] = [{ ...candidates[0]!, totalMinutes: 2000 }]
    expect(recommend(graph, slow, fullPantry, { maxTotalMinutes: 120 })).toHaveLength(0)
  })

  it('skips a cyclic recipe rather than throwing', () => {
    const a = recipe('cycle-a', [item({ component: 'cycle-b' }, exact(10, 'g'))], {
      baseYield: new Decimal(100),
      yieldUnit: 'g',
    })
    const b = recipe('cycle-b', [item({ component: 'cycle-a' }, exact(10, 'g'))], {
      baseYield: new Decimal(100),
      yieldUnit: 'g',
    })
    const graph = graphFrom([a, b], [ing('salt')])
    const results = recommend(
      graph,
      [{ ...candidates[0]!, recipeId: 'cycle-a' }],
      [],
    )
    expect(results).toHaveLength(0)
  })
})

describe('substitutions', () => {
  const subs: Substitution[] = [
    {
      fromIngredientId: 'mozzarella',
      toIngredientId: 'mozzarella-di-bufala',
      styleId: null,
      qualityGrade: 'equivalent',
      approved: true,
      explanationKey: 'sub.bufala',
    },
    {
      fromIngredientId: 'pepperoni',
      toIngredientId: 'soppressata',
      styleId: 'napoletana',
      qualityGrade: 'good',
      approved: true,
      explanationKey: 'sub.soppressata',
    },
    {
      fromIngredientId: 'tomatoes',
      toIngredientId: 'ketchup',
      styleId: null,
      qualityGrade: 'last_resort',
      approved: false,
      explanationKey: 'sub.ketchup',
    },
  ]

  it('only returns approved swaps', () => {
    // Ketchup is present in the table but never approved, so it can never be
    // offered as a stand-in for tomatoes.
    expect(allowedSubstitutions(subs, 'tomatoes', null)).toHaveLength(0)
  })

  it('respects style compatibility', () => {
    expect(allowedSubstitutions(subs, 'pepperoni', 'napoletana')).toHaveLength(1)
    expect(allowedSubstitutions(subs, 'pepperoni', 'romana')).toHaveLength(0)
  })

  it('allows style-agnostic swaps everywhere', () => {
    expect(allowedSubstitutions(subs, 'mozzarella', 'romana')).toHaveLength(1)
  })
})
