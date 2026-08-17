import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import {
  type DomainIngredient,
  type DomainRecipe,
  RecipeCycleError,
  computeBakersPercentages,
  expandRecipe,
  graphFrom,
  isUnit,
} from '@/domain'
import { seedCatalog } from './index'
import { toDomainGraph } from './to-domain'

const { ingredients, recipes, categories, packageOptions, substitutions } = seedCatalog

describe('seed integrity', () => {
  it('has unique slugs everywhere', () => {
    const check = (name: string, slugs: string[]) => {
      expect(new Set(slugs).size, `${name} has duplicate slugs`).toBe(slugs.length)
    }
    check('ingredients', ingredients.map((i) => i.slug))
    check('recipes', recipes.map((r) => r.slug))
    check('categories', categories.map((c) => c.slug))
    check('packages', packageOptions.map((p) => p.slug))
  })

  it('references only categories that exist', () => {
    const known = new Set(categories.map((c) => c.slug))
    for (const ingredient of ingredients) {
      expect(known, `${ingredient.slug} category`).toContain(ingredient.categorySlug)
    }
  })

  it('references only ingredients and recipes that exist', () => {
    const knownIngredients = new Set(ingredients.map((i) => i.slug))
    const knownRecipes = new Set(recipes.map((r) => r.slug))

    for (const recipe of recipes) {
      for (const item of recipe.items) {
        // Exactly one of the two references must be set.
        const refs = [item.ingredientSlug, item.componentSlug].filter(Boolean)
        expect(refs, `${recipe.slug}/${item.key} must reference exactly one target`).toHaveLength(1)

        if (item.ingredientSlug) {
          expect(knownIngredients, `${recipe.slug}/${item.key}`).toContain(item.ingredientSlug)
        }
        if (item.componentSlug) {
          expect(knownRecipes, `${recipe.slug}/${item.key}`).toContain(item.componentSlug)
        }
      }
    }
  })

  it('gives every ingredient and recipe all three locales', () => {
    for (const ingredient of ingredients) {
      for (const locale of ['ru', 'en', 'fr'] as const) {
        expect(ingredient.names[locale]?.length, `${ingredient.slug}.${locale}`).toBeGreaterThan(0)
      }
    }
    for (const recipe of recipes) {
      for (const locale of ['ru', 'en', 'fr'] as const) {
        expect(recipe.names[locale]?.length, `${recipe.slug}.${locale}`).toBeGreaterThan(0)
      }
    }
  })

  it('uses only known units', () => {
    for (const recipe of recipes) {
      for (const item of recipe.items) {
        if (item.amount.kind === 'unknown') continue
        expect(isUnit(item.amount.unit), `${recipe.slug}/${item.key}: ${item.amount.unit}`).toBe(
          true,
        )
      }
    }
  })

  it('keeps package options pointing at real ingredients', () => {
    const known = new Set(ingredients.map((i) => i.slug))
    for (const pkg of packageOptions) expect(known).toContain(pkg.ingredientSlug)
  })

  it('keeps substitutions pointing at real ingredients', () => {
    const known = new Set(ingredients.map((i) => i.slug))
    for (const sub of substitutions) {
      expect(known).toContain(sub.fromSlug)
      expect(known).toContain(sub.toSlug)
    }
  })

  it('has no cycles among component recipes', () => {
    const { graph } = toDomainGraph()
    for (const recipe of recipes) {
      expect(() => expandRecipe(graph, recipe.slug, 1), `${recipe.slug}`).not.toThrow(
        RecipeCycleError,
      )
    }
  })

  it('references only steps whose item keys exist', () => {
    for (const recipe of recipes) {
      const keys = new Set(recipe.items.map((i) => i.key))
      for (const step of recipe.steps) {
        for (const key of step.itemKeys ?? []) {
          expect(keys, `${recipe.slug}/${step.key} -> ${key}`).toContain(key)
        }
      }
    }
  })

  it('ties evidence to item keys that exist', () => {
    for (const recipe of recipes) {
      const keys = new Set(recipe.items.map((i) => i.key))
      for (const evidence of recipe.evidence ?? []) {
        if (!evidence.itemKey) continue
        expect(keys, `${recipe.slug} evidence -> ${evidence.itemKey}`).toContain(evidence.itemKey)
      }
    }
  })
})

describe('honesty rules the seed must uphold', () => {
  it('never labels the owner\'s own pizzas as traditional', () => {
    const ownerPizzas = recipes.filter((r) => r.slug.endsWith('-user') && r.type === 'pizza')
    expect(ownerPizzas.length).toBeGreaterThan(0)
    for (const pizza of ownerPizzas) {
      expect(pizza.authenticity, pizza.slug).not.toBe('traditional')
    }
  })

  it('marks every unknown amount with a review flag on its recipe', () => {
    for (const recipe of recipes) {
      const hasUnknown = recipe.items.some((i) => i.amount.kind === 'unknown')
      if (!hasUnknown) continue
      const flagged =
        recipe.status === 'needs_review' ||
        recipe.status === 'draft' ||
        (recipe.evidence ?? []).length > 0
      expect(flagged, `${recipe.slug} has unknown amounts but is not flagged`).toBe(true)
    }
  })

  it('never marks a recipe verified while it still carries a conflict', () => {
    for (const recipe of recipes) {
      const hasConflict = (recipe.evidence ?? []).some((e) => e.reviewState === 'conflict')
      if (hasConflict) expect(recipe.status, recipe.slug).not.toBe('verified')
    }
  })

  it('records the pesto yield conflict instead of correcting it', () => {
    const pesto = recipes.find((r) => r.slug === 'pesto-genovese-user')!
    const conflict = (pesto.evidence ?? []).find((e) => e.field === 'recipe.baseYield')
    expect(conflict?.reviewState).toBe('conflict')
    expect(pesto.status).toBe('needs_review')

    // The ingredients really do exceed the stated yield; that is the point.
    const totalG = pesto.items
      .filter((i) => i.amount.kind === 'exact' && i.amount.unit === 'g')
      .reduce(
        (acc, i) => acc.plus(i.amount.kind === 'exact' ? i.amount.value : 0),
        new Decimal(0),
      )
    expect(totalG.greaterThan(150)).toBe(true)
  })

  it('keeps the Iacopelli dough in needs_review with salt and yeast as conflicts', () => {
    const dough = recipes.find((r) => r.slug === 'iacopelli-poolish-double-fermentation')!
    expect(dough.status).toBe('needs_review')

    const conflicts = (dough.evidence ?? []).filter((e) => e.reviewState === 'conflict')
    expect(conflicts.map((c) => c.itemKey)).toContain('final-salt')
    expect(conflicts.map((c) => c.itemKey)).toContain('poolish-yeast')

    // The disputed values stay ranges; no single value is silently picked.
    const salt = dough.items.find((i) => i.key === 'final-salt')!
    expect(salt.amount.kind).toBe('range')
    const yeast = dough.items.find((i) => i.key === 'poolish-yeast')!
    expect(yeast.amount.kind).toBe('range')
  })

  it('leaves the arrabbiata sausage unspecified rather than guessing', () => {
    const pizza = recipes.find((r) => r.slug === 'arrabbiata-user')!
    const sausage = pizza.items.find((i) => i.key === 'sausage')!
    expect(sausage.amount.kind).toBe('unknown')
    expect(pizza.status).toBe('needs_review')
    expect((pizza.evidence ?? []).some((e) => e.itemKey === 'sausage')).toBe(true)
  })

  it('never approves a nonsense substitution', () => {
    const bad = substitutions.find(
      (s) => s.fromSlug === 'tomatoes-whole-peeled-canned' && s.toSlug === 'chili-flakes',
    )
    expect(bad?.approved).toBe(false)
  })

  it('keeps the tomato sauce yield unset until a can size is chosen', () => {
    const sauce = recipes.find((r) => r.slug === 'tomato-sauce-user')!
    expect(sauce.baseYield).toBeNull()
    expect(sauce.status).toBe('needs_review')
  })

  it('does not add sugar, garlic or oregano to the owner\'s tomato sauce', () => {
    const sauce = recipes.find((r) => r.slug === 'tomato-sauce-user')!
    const slugs = sauce.items.map((i) => i.ingredientSlug)
    expect(slugs).toEqual([
      'tomatoes-whole-peeled-canned',
      'basil-fresh',
      'olive-oil-extra-virgin',
      'salt-sea',
    ])
  })
})

describe('seeded dough formulas', () => {
  it("reproduces Sisofo's stated hydration and salt percentages", () => {
    const dough = recipes.find((r) => r.slug === 'sisofo-forgotten-neapolitan')!
    const gramsOf = (key: string) => {
      const amount = dough.items.find((i) => i.key === key)!.amount
      return amount.kind === 'exact' ? amount.value : '0'
    }
    const percentages = computeBakersPercentages({
      preferment: 'none',
      components: [
        { ingredientId: 'flour', role: 'flour', grams: gramsOf('flour') },
        { ingredientId: 'water', role: 'water', grams: gramsOf('water') },
        { ingredientId: 'salt', role: 'salt', grams: gramsOf('salt') },
        { ingredientId: 'yeast', role: 'yeast', grams: gramsOf('yeast') },
      ],
    })
    expect(percentages.hydrationPct.toDecimalPlaces(2).toString()).toBe('59.62')
    expect(percentages.saltPct.toDecimalPlaces(2).toString()).toBe('2.5')
  })

  it("reproduces the Roman tonda hydration", () => {
    const dough = recipes.find((r) => r.slug === 'sisofo-roman-thin-crust')!
    const gramsOf = (key: string) => {
      const amount = dough.items.find((i) => i.key === key)!.amount
      return amount.kind === 'exact' ? amount.value : '0'
    }
    const percentages = computeBakersPercentages({
      preferment: 'none',
      components: [
        { ingredientId: 'flour', role: 'flour', grams: gramsOf('flour') },
        { ingredientId: 'water', role: 'water', grams: gramsOf('water') },
      ],
    })
    expect(percentages.hydrationPct.toDecimalPlaces(2).toString()).toBe('55.26')
  })
})

describe('domain projection', () => {
  it('produces a usable graph', () => {
    const { graph, recipes: domainRecipes, ingredients: domainIngredients } = toDomainGraph()
    expect(domainRecipes.length).toBe(recipes.length)
    expect(domainIngredients.length).toBe(ingredients.length)

    const sauce: DomainRecipe | undefined = graph.recipe('tomato-sauce-user')
    expect(sauce?.type).toBe('sauce')

    const oil: DomainIngredient | undefined = graph.ingredient('olive-oil-extra-virgin')
    expect(oil?.densityGPerMl).toBe('0.91')
  })

  it('reports a clear issue when a pizza uses a sauce with no yield', () => {
    const { graph } = toDomainGraph()
    const { issues } = expandRecipe(graph, 'margherita-user', 1)
    // The sauce has no yield yet (it depends on the can size), so the component
    // cannot be broken down -- and the app says exactly that instead of guessing.
    expect(issues.length).toBeGreaterThan(0)
    expect(issues.map((i) => i.code)).toContain('component_yield_unknown')
  })

  it('builds a graph that graphFrom accepts directly', () => {
    const { recipes: r, ingredients: i } = toDomainGraph()
    expect(() => graphFrom(r, i)).not.toThrow()
  })
})
