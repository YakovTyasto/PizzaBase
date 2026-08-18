import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { UNKNOWN, exact, qualitative } from './amount'
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
    expect(
      mozzarella?.short && mozzarella.short.kind === 'exact' && mozzarella.short.value.toString(),
    ).toBe('60')
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
    expect(recommend(graph, experimental, fullPantry, { includeExperimental: true })).toHaveLength(
      1,
    )
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
    const results = recommend(graph, [{ ...candidates[0]!, recipeId: 'cycle-a' }], [])
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

/**
 * Coverage when the recipe itself is the thing that is missing.
 *
 * The defect these guard: an unstated mandatory amount used to be skipped
 * entirely, which left the coverage denominator empty and the ratio at the
 * hard-coded 1 for "nothing to check". A recipe nobody had finished writing
 * therefore reported 100% coverage and offered itself as cookable.
 */
describe('coverage when a mandatory quantity is unknown', () => {
  const stocked: PantryEntry[] = [
    { ingredientId: 'mozzarella', amount: exact(1, 'kg') },
    { ingredientId: 'tomatoes', amount: exact(2, 'kg') },
    { ingredientId: 'olive-oil', amount: exact(500, 'ml') },
    { ingredientId: 'parmesan', amount: exact(200, 'g') },
  ]

  it('does not call an unstated amount covered', () => {
    const draft = recipe('half-written', [
      item({ ingredient: 'mozzarella' }, exact(100, 'g')),
      item({ ingredient: 'olive-oil' }, UNKNOWN),
    ])
    const graph = graphFrom([draft], pizzaFixture().ingredients)

    const result = evaluateCoverage(graph, 'half-written', stocked)
    expect(result.coverage).toBeLessThan(1)
    expect(result.dataComplete).toBe(false)
    expect(result.unknownRequired.map((entry) => entry.ingredientId)).toContain('olive-oil')
  })

  it('never reports canCookNow for a recipe with an unstated mandatory amount', () => {
    const draft = recipe('half-written', [
      item({ ingredient: 'mozzarella' }, exact(100, 'g')),
      item({ ingredient: 'olive-oil' }, UNKNOWN),
    ])
    const graph = graphFrom([draft], pizzaFixture().ingredients)

    const results = recommend(graph, [{ ...candidates[0]!, recipeId: 'half-written' }], stocked)
    expect(results[0]?.canCookNow).toBe(false)
    expect(results[0]?.dataComplete).toBe(false)
  })

  it('gives a recipe with nothing numeric a coverage of zero, not one', () => {
    const vague = recipe('all-to-taste', [
      item({ ingredient: 'salt' }, qualitative('to_taste')),
      item({ ingredient: 'basil' }, qualitative('to_taste')),
    ])
    const graph = graphFrom([vague], pizzaFixture().ingredients)

    const result = evaluateCoverage(graph, 'all-to-taste', stocked)
    expect(result.requiredCount).toBe(0)
    expect(result.coverage).toBe(0)
    expect(result.dataComplete).toBe(false)
  })

  it('lets an unstated *optional* amount through without blocking', () => {
    const draft = recipe('garnished', [
      item({ ingredient: 'mozzarella' }, exact(100, 'g')),
      item({ ingredient: 'basil' }, UNKNOWN, { optional: true }),
    ])
    const graph = graphFrom([draft], pizzaFixture().ingredients)

    const result = evaluateCoverage(graph, 'garnished', stocked)
    expect(result.dataComplete).toBe(true)
    expect(result.coverage).toBe(1)
    // Still surfaced, just separately from the blocking list.
    expect(result.unknownOptional.map((entry) => entry.ingredientId)).toContain('basil')
    expect(result.unknownRequired).toEqual([])
  })

  it('keeps a mandatory "to taste" out of the blocking list', () => {
    const { graph } = pizzaFixture()
    const result = evaluateCoverage(graph, 'margherita', stocked)

    expect(result.unknownRequired).toEqual([])
    expect(result.unknownOptional.map((entry) => entry.reason)).toContain('qualitative')
    expect(result.coverage).toBe(1)
  })

  it('treats a component it cannot break down as incomplete data', () => {
    const sauce = recipe('mystery-sauce', [item({ ingredient: 'tomatoes' }, exact(400, 'g'))], {
      type: 'sauce',
    })
    const pizza = recipe('on-mystery-sauce', [
      item({ component: 'mystery-sauce' }, exact(80, 'g')),
      item({ ingredient: 'mozzarella' }, exact(100, 'g')),
    ])
    const graph = graphFrom([sauce, pizza], pizzaFixture().ingredients)

    // The sauce states no yield, so its share of the tomatoes is unknowable.
    const result = evaluateCoverage(graph, 'on-mystery-sauce', stocked)
    expect(result.issues.length).toBeGreaterThan(0)
    expect(result.dataComplete).toBe(false)
  })

  it('deducts across units, so 1 kg on hand covers 100 g needed', () => {
    const draft = recipe('one-cheese', [item({ ingredient: 'mozzarella' }, exact(100, 'g'))])
    const graph = graphFrom([draft], pizzaFixture().ingredients)

    const result = evaluateCoverage(graph, 'one-cheese', [
      { ingredientId: 'mozzarella', amount: exact(1, 'kg') },
    ])
    expect(result.coverage).toBe(1)
    expect(result.dataComplete).toBe(true)
  })

  it('reports an empty pantry as zero coverage rather than as complete', () => {
    const { graph } = pizzaFixture()
    const result = evaluateCoverage(graph, 'pepperoni', [])

    expect(result.coverage).toBe(0)
    expect(result.missingRequiredCount).toBeGreaterThan(0)
  })
})

describe('ranking against incomplete recipes', () => {
  it('puts a verified, calculable recipe above an incomplete draft', () => {
    const { ingredients } = pizzaFixture()
    const complete = recipe('complete', [
      item({ ingredient: 'mozzarella' }, exact(100, 'g')),
      item({ ingredient: 'tomatoes' }, exact(80, 'g')),
    ])
    const vague = recipe('vague', [
      item({ ingredient: 'mozzarella' }, exact(100, 'g')),
      item({ ingredient: 'tomatoes' }, UNKNOWN),
    ])
    const graph = graphFrom([complete, vague], ingredients)

    const results = recommend(
      graph,
      [
        // The draft is given the *better* provenance on purpose: completeness
        // has to win anyway, or a half-written recipe outranks a usable one.
        {
          recipeId: 'vague',
          authenticity: 'traditional',
          status: 'draft',
          styleId: null,
          sourceCredibility: 1,
          totalMinutes: null,
          ovenProfileId: null,
        },
        {
          recipeId: 'complete',
          authenticity: 'modern_italian',
          status: 'verified',
          styleId: null,
          sourceCredibility: 0.5,
          totalMinutes: null,
          ovenProfileId: null,
        },
      ],
      [
        { ingredientId: 'mozzarella', amount: exact(1, 'kg') },
        { ingredientId: 'tomatoes', amount: exact(1, 'kg') },
      ],
    )

    expect(results[0]?.recipeId).toBe('complete')
    expect(results[0]?.canCookNow).toBe(true)
    expect(results[1]?.recipeId).toBe('vague')
    expect(results[1]?.canCookNow).toBe(false)
  })
})
