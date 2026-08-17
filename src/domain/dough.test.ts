import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import {
  type DoughFormula,
  DoughError,
  computeBakersPercentages,
  formulaFromPercentages,
  roundForKitchen,
  scaleDough,
} from './dough'

/**
 * Julian Sisofo, "The Forgotten Style of Neapolitan Pizza": 520 g flour,
 * 310 g water, 13 g salt, 0.16 g yeast for 3 pizzas.
 */
const sisofoNeapolitan: DoughFormula = {
  preferment: 'none',
  components: [
    { ingredientId: 'flour-00', role: 'flour', grams: 520 },
    { ingredientId: 'water', role: 'water', grams: 310 },
    { ingredientId: 'salt', role: 'salt', grams: 13 },
    { ingredientId: 'yeast', role: 'yeast', grams: '0.156' },
  ],
}

describe("baker's percentages", () => {
  it('treats flour as 100% and derives the rest', () => {
    const p = computeBakersPercentages(sisofoNeapolitan)
    expect(p.totalFlourG.toString()).toBe('520')
    // 310 / 520 = 59.615...%, matching the stated 59.62%
    expect(p.hydrationPct.toDecimalPlaces(2).toString()).toBe('59.62')
    expect(p.saltPct.toDecimalPlaces(2).toString()).toBe('2.5')
    expect(p.yeastPct.toDecimalPlaces(2).toString()).toBe('0.03')
  })

  it('reports the preferment share of total flour', () => {
    const biga: DoughFormula = {
      preferment: 'biga',
      components: [
        { ingredientId: 'flour', role: 'flour', grams: 400, stage: 'preferment' },
        { ingredientId: 'water', role: 'water', grams: 200, stage: 'preferment' },
        { ingredientId: 'yeast', role: 'yeast', grams: 2, stage: 'preferment' },
        { ingredientId: 'flour', role: 'flour', grams: 600, stage: 'final' },
        { ingredientId: 'water', role: 'water', grams: 500, stage: 'final' },
        { ingredientId: 'salt', role: 'salt', grams: 25, stage: 'final' },
      ],
    }
    const p = computeBakersPercentages(biga)
    expect(p.totalFlourG.toString()).toBe('1000')
    expect(p.prefermentFlourPct.toString()).toBe('40')
    expect(p.hydrationPct.toString()).toBe('70')
  })

  it('refuses a formula with no flour', () => {
    expect(() =>
      computeBakersPercentages({ preferment: 'none', components: [] }),
    ).toThrow(DoughError)
  })
})

describe('scaling a dough to a target mass', () => {
  it('hits the requested total and preserves every percentage', () => {
    const scaled = scaleDough(sisofoNeapolitan, 4, 280)
    expect(scaled.targetTotalG.toString()).toBe('1120')

    const original = computeBakersPercentages(sisofoNeapolitan)
    expect(scaled.percentages.hydrationPct.toDecimalPlaces(4).toString()).toBe(
      original.hydrationPct.toDecimalPlaces(4).toString(),
    )

    const flour = scaled.components.find((c) => c.role === 'flour')!
    const water = scaled.components.find((c) => c.role === 'water')!
    expect(water.grams.dividedBy(flour.grams).times(100).toDecimalPlaces(2).toString()).toBe(
      '59.62',
    )
  })

  it('stays close to the target mass after kitchen rounding', () => {
    const scaled = scaleDough(sisofoNeapolitan, 6, 250)
    const drift = scaled.achievedTotalG.minus(scaled.targetTotalG).abs()
    // 1500 g of dough should not drift by more than a gram or two.
    expect(drift.lessThanOrEqualTo(2)).toBe(true)
  })

  it('keeps tiny yeast weights precise instead of rounding them away', () => {
    const scaled = scaleDough(sisofoNeapolitan, 3, 281)
    const yeast = scaled.components.find((c) => c.role === 'yeast')!
    expect(yeast.displayGrams.greaterThan(0)).toBe(true)
    expect(yeast.displayGrams.toString()).toBe('0.16')
  })

  it('rejects nonsensical ball counts and weights', () => {
    expect(() => scaleDough(sisofoNeapolitan, 0, 250)).toThrow(DoughError)
    expect(() => scaleDough(sisofoNeapolitan, 2.5, 250)).toThrow(DoughError)
    expect(() => scaleDough(sisofoNeapolitan, 3, 0)).toThrow(DoughError)
  })
})

describe('rounding for the kitchen', () => {
  it('keeps more decimals for small weights', () => {
    expect(roundForKitchen(new Decimal('0.156')).toString()).toBe('0.16')
    expect(roundForKitchen(new Decimal('8.44')).toString()).toBe('8.4')
    expect(roundForKitchen(new Decimal('312.6')).toString()).toBe('313')
  })
})

describe('building a formula from percentages', () => {
  it('round-trips hydration', () => {
    const formula = formulaFromPercentages({
      flourIngredientId: 'flour',
      waterIngredientId: 'water',
      saltIngredientId: 'salt',
      yeastIngredientId: 'yeast',
      flourG: 1000,
      hydrationPct: 65,
      saltPct: 2.8,
      yeastPct: 0.2,
    })
    const p = computeBakersPercentages(formula)
    expect(p.hydrationPct.toString()).toBe('65')
    expect(p.saltPct.toString()).toBe('2.8')
  })
})
