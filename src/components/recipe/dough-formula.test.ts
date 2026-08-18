import { describe, expect, it, vi } from 'vitest'
import { computeBakersPercentages, scaleDough, withinTolerance } from '@/domain'
import { DemoRepository } from '@/lib/data/demo/repository'
import { doughFormulaFor, roleForIngredient } from './dough-formula'

/**
 * Turning a seeded recipe into a dough formula.
 *
 * This is the seam where the reported defects lived: range amounts were being
 * dropped on the way in, so salt stated as "25-30 g" reached the percentage
 * calculation as nothing at all and rendered as 0%.
 */

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}))

const repository = new DemoRepository(false)

describe('mapping ingredient slugs onto roles', () => {
  it('recognises the roles the percentages are built from', () => {
    expect(roleForIngredient('flour-type-00')).toBe('flour')
    expect(roleForIngredient('water')).toBe('water')
    expect(roleForIngredient('salt-sea')).toBe('salt')
    expect(roleForIngredient('yeast-active-dry')).toBe('yeast')
    expect(roleForIngredient('olive-oil-extra-virgin')).toBe('oil')
    expect(roleForIngredient('honey')).toBe('honey')
  })

  it('files anything unrecognised as other rather than guessing', () => {
    expect(roleForIngredient('mozzarella-fior-di-latte')).toBe('other')
  })
})

describe('the Iacopelli poolish formula', () => {
  it('keeps both bounds of every disputed weight', async () => {
    const recipe = await repository.getRecipe('en', 'iacopelli-poolish-double-fermentation')
    const formula = doughFormulaFor(recipe!)
    expect(formula).not.toBeNull()

    const salt = formula!.components.find((component) => component.role === 'salt')!
    expect(String(salt.gramsMin)).toBe('25')
    expect(String(salt.gramsMax)).toBe('30')

    const yeast = formula!.components.find((component) => component.role === 'yeast')!
    expect(String(yeast.gramsMin)).toBe('5')
    expect(String(yeast.gramsMax)).toBe('6')
  })

  it('reports salt as 2.5-3% and yeast as 0.5-0.6%, never 0%', async () => {
    const recipe = await repository.getRecipe('en', 'iacopelli-poolish-double-fermentation')
    const percentages = computeBakersPercentages(doughFormulaFor(recipe!)!)

    expect(percentages.totalFlourG.toString()).toBe('1000')
    expect(percentages.saltPct.min.toDecimalPlaces(2).toString()).toBe('2.5')
    expect(percentages.saltPct.max.toDecimalPlaces(2).toString()).toBe('3')
    expect(percentages.yeastPct.min.toDecimalPlaces(2).toString()).toBe('0.5')
    expect(percentages.yeastPct.max.toDecimalPlaces(2).toString()).toBe('0.6')
    expect(percentages.hydrationPct.nominal.toDecimalPlaces(0).toString()).toBe('70')
  })

  it('separates the poolish from the final dough', async () => {
    const recipe = await repository.getRecipe('en', 'iacopelli-poolish-double-fermentation')
    const formula = doughFormulaFor(recipe!)!

    expect(formula.preferment).toBe('poolish')
    const percentages = computeBakersPercentages(formula)
    // 300 g of the 1000 g of flour sits in the poolish.
    expect(percentages.prefermentFlourPct.nominal.toDecimalPlaces(0).toString()).toBe('30')
  })

  it('scales 3 x 250 g to about 750 g rather than several kilograms', async () => {
    const recipe = await repository.getRecipe('en', 'iacopelli-poolish-double-fermentation')
    const scaled = scaleDough(doughFormulaFor(recipe!)!, 3, 250)

    expect(scaled.targetTotalG.toString()).toBe('750')
    expect(withinTolerance(scaled)).toBe(true)

    const flour = scaled.components
      .filter((component) => component.role === 'flour')
      .reduce((sum, component) => sum.plus(component.grams), scaled.targetTotalG.times(0))
    expect(flour.toDecimalPlaces(0).toString()).toBe('429')
  })

  it('changes the ingredients when the ball weight changes', async () => {
    const recipe = await repository.getRecipe('en', 'iacopelli-poolish-double-fermentation')
    const formula = doughFormulaFor(recipe!)!

    const at250 = scaleDough(formula, 3, 250)
    const at300 = scaleDough(formula, 3, 300)

    expect(at300.targetTotalG.toString()).toBe('900')
    expect(withinTolerance(at300)).toBe(true)
    for (const [index, component] of at300.components.entries()) {
      expect(component.grams.greaterThan(at250.components[index]!.grams)).toBe(true)
    }
  })
})

describe('the Sisofo Neapolitan formula still works', () => {
  it('gives about 843 g at the stated 3 x 281 g', async () => {
    const recipe = await repository.getRecipe('en', 'sisofo-forgotten-neapolitan')
    const scaled = scaleDough(doughFormulaFor(recipe!)!, 3, 281)

    expect(scaled.targetTotalG.toString()).toBe('843')
    expect(withinTolerance(scaled)).toBe(true)
    // The source batch is 843.156 g, so this is essentially the recipe as written.
    expect(scaled.factor.toDecimalPlaces(3).toString()).toBe('1')
  })

  it('gives 900 g at 3 x 300 g and moves every scalable ingredient', async () => {
    const recipe = await repository.getRecipe('en', 'sisofo-forgotten-neapolitan')
    const formula = doughFormulaFor(recipe!)!

    const stated = scaleDough(formula, 3, 281)
    const bigger = scaleDough(formula, 3, 300)

    expect(bigger.targetTotalG.toString()).toBe('900')
    expect(withinTolerance(bigger)).toBe(true)
    for (const [index, component] of bigger.components.entries()) {
      expect(component.displayGrams.equals(stated.components[index]!.displayGrams)).toBe(false)
    }
  })
})

describe('a recipe that is not a dough', () => {
  it('has no formula, so no hydration editor is ever offered', async () => {
    for (const slug of ['tomato-sauce-user', 'margherita-user']) {
      const recipe = await repository.getRecipe('en', slug)
      expect(doughFormulaFor(recipe!)).toBeNull()
    }
  })
})
