import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import {
  type DoughFormula,
  DoughError,
  computeBakersPercentages,
  formulaFromPercentages,
  isPlausibleHydration,
  referenceBatchMass,
  roundForKitchen,
  scaleDough,
  withHydration,
  withinTolerance,
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

/**
 * Vito Iacopelli's poolish formula, which states neither a ball count nor a
 * ball weight and reports two of its weights as disputed ranges. It is the
 * case every rule below exists for.
 */
const iacopelliPoolish: DoughFormula = {
  preferment: 'poolish',
  components: [
    { ingredientId: 'water', role: 'water', grams: 300, stage: 'preferment' },
    { ingredientId: 'flour-00', role: 'flour', grams: 300, stage: 'preferment' },
    { ingredientId: 'honey', role: 'honey', grams: 5, stage: 'preferment' },
    {
      ingredientId: 'yeast',
      role: 'yeast',
      grams: '5.5',
      gramsMin: 5,
      gramsMax: 6,
      stage: 'preferment',
    },
    { ingredientId: 'water', role: 'water', grams: 400, stage: 'final' },
    { ingredientId: 'flour-00', role: 'flour', grams: 700, stage: 'final' },
    {
      ingredientId: 'salt',
      role: 'salt',
      grams: '27.5',
      gramsMin: 25,
      gramsMax: 30,
      stage: 'final',
    },
    { ingredientId: 'olive-oil', role: 'oil', grams: 10, stage: 'final' },
  ],
}

describe("baker's percentages", () => {
  it('treats flour as 100% and derives the rest', () => {
    const p = computeBakersPercentages(sisofoNeapolitan)
    expect(p.totalFlourG.toString()).toBe('520')
    // 310 / 520 = 59.615...%, matching the stated 59.62%
    expect(p.hydrationPct.nominal.toDecimalPlaces(2).toString()).toBe('59.62')
    expect(p.saltPct.nominal.toDecimalPlaces(2).toString()).toBe('2.5')
    expect(p.yeastPct.nominal.toDecimalPlaces(2).toString()).toBe('0.03')
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
    expect(p.prefermentFlourPct.nominal.toString()).toBe('40')
    expect(p.hydrationPct.nominal.toString()).toBe('70')
  })

  it('refuses a formula with no flour', () => {
    expect(() => computeBakersPercentages({ preferment: 'none', components: [] })).toThrow(
      DoughError,
    )
  })
})

/**
 * The regression this whole type exists for: a range used to be dropped from
 * the formula entirely, so a perfectly well-documented salt weight rendered as
 * "0%" of the flour.
 */
describe("baker's percentages for the four amount shapes", () => {
  const p = computeBakersPercentages(iacopelliPoolish)

  it('keeps an exact amount a single figure', () => {
    expect(p.oilPct.min.toString()).toBe('1')
    expect(p.oilPct.max.toString()).toBe('1')
    expect(p.hydrationPct.nominal.toString()).toBe('70')
  })

  it('renders 25-30 g of salt against 1000 g of flour as 2.5-3%', () => {
    expect(p.saltPct.min.toDecimalPlaces(2).toString()).toBe('2.5')
    expect(p.saltPct.max.toDecimalPlaces(2).toString()).toBe('3')
    expect(p.saltPct.nominal.toDecimalPlaces(3).toString()).toBe('2.75')
  })

  it('renders 5-6 g of yeast against 1000 g of flour as 0.5-0.6%', () => {
    expect(p.yeastPct.min.toDecimalPlaces(2).toString()).toBe('0.5')
    expect(p.yeastPct.max.toDecimalPlaces(2).toString()).toBe('0.6')
  })

  it('never turns a stated range into zero', () => {
    expect(p.saltPct.min.isZero()).toBe(false)
    expect(p.yeastPct.min.isZero()).toBe(false)
  })

  it('widens a percentage on both sides when the flour is itself a range', () => {
    const wobbly = computeBakersPercentages({
      preferment: 'none',
      components: [
        { ingredientId: 'flour', role: 'flour', grams: 1000, gramsMin: 900, gramsMax: 1100 },
        { ingredientId: 'water', role: 'water', grams: 700 },
      ],
    })
    // Most hydrated pairing is the least flour, and vice versa.
    expect(wobbly.hydrationPct.min.toDecimalPlaces(2).toString()).toBe('63.64')
    expect(wobbly.hydrationPct.max.toDecimalPlaces(2).toString()).toBe('77.78')
  })

  it('carries a qualitative or unstated weight through as unknown, not zero', () => {
    const partial = computeBakersPercentages({
      preferment: 'none',
      components: [
        { ingredientId: 'flour', role: 'flour', grams: 1000 },
        { ingredientId: 'water', role: 'water', grams: 650 },
        { ingredientId: 'salt', role: 'salt', grams: 0, unknown: true },
      ],
    })
    expect(partial.complete).toBe(false)
    expect(partial.unknownComponents).toEqual(['salt'])
    // The unknown salt contributes no mass rather than a fabricated zero.
    expect(partial.totalDoughG.toString()).toBe('1650')
    expect(partial.saltPct.max.toString()).toBe('0')
  })
})

describe('the reference batch mass', () => {
  it('is the sum of the stated amounts, midpoints for ranges', () => {
    const batch = referenceBatchMass(iacopelliPoolish)
    // 300+300+5+400+700+10 exact, plus 5-6 yeast and 25-30 salt.
    expect(batch.min.toString()).toBe('1745')
    expect(batch.max.toString()).toBe('1751')
    expect(batch.nominal.toString()).toBe('1748')
  })
})

describe('scaling a dough to a target mass', () => {
  it('hits the requested total and preserves every percentage', () => {
    const scaled = scaleDough(sisofoNeapolitan, 4, 280)
    expect(scaled.targetTotalG.toString()).toBe('1120')

    const original = computeBakersPercentages(sisofoNeapolitan)
    expect(scaled.percentages.hydrationPct.nominal.toDecimalPlaces(4).toString()).toBe(
      original.hydrationPct.nominal.toDecimalPlaces(4).toString(),
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
    expect(withinTolerance(scaled)).toBe(true)
  })

  it('keeps tiny yeast weights precise instead of rounding them away', () => {
    const scaled = scaleDough(sisofoNeapolitan, 3, 281)
    const yeast = scaled.components.find((c) => c.role === 'yeast')!
    expect(yeast.displayGrams.greaterThan(0)).toBe(true)
    expect(yeast.displayGrams.toString()).toBe('0.16')
  })

  it('gives about 843 g for the stated 3 x 281 g', () => {
    const scaled = scaleDough(sisofoNeapolitan, 3, 281)
    expect(scaled.targetTotalG.toString()).toBe('843')
    expect(scaled.achievedTotalG.minus(843).abs().lessThanOrEqualTo(1)).toBe(true)
  })

  it('changes every scalable ingredient when the ball weight changes', () => {
    const before = scaleDough(sisofoNeapolitan, 3, 281)
    const after = scaleDough(sisofoNeapolitan, 3, 300)

    expect(after.targetTotalG.toString()).toBe('900')
    expect(after.achievedTotalG.minus(900).abs().lessThanOrEqualTo(1)).toBe(true)

    for (const component of after.components) {
      const previous = before.components.find((c) => c.ingredientId === component.ingredientId)!
      expect(component.displayGrams.equals(previous.displayGrams)).toBe(false)
    }
  })

  it('rejects nonsensical ball counts and weights', () => {
    expect(() => scaleDough(sisofoNeapolitan, 0, 250)).toThrow(DoughError)
    expect(() => scaleDough(sisofoNeapolitan, 2.5, 250)).toThrow(DoughError)
    expect(() => scaleDough(sisofoNeapolitan, 3, 0)).toThrow(DoughError)
  })
})

/**
 * The reported defect: 3 x 250 g of the Iacopelli formula produced about 3 kg
 * of flour and 2.1 kg of water, because a missing `baseYield` was being read as
 * "the whole source batch is one pizza".
 */
describe('scaling a formula that states no yield', () => {
  it('scales down to the requested 750 g rather than up to several kilos', () => {
    const scaled = scaleDough(iacopelliPoolish, 3, 250)
    expect(scaled.targetTotalG.toString()).toBe('750')

    const flour = scaled.components
      .filter((c) => c.role === 'flour')
      .reduce((sum, c) => sum.plus(c.grams), new Decimal(0))
    const water = scaled.components
      .filter((c) => c.role === 'water')
      .reduce((sum, c) => sum.plus(c.grams), new Decimal(0))

    // 1000 g of flour in a 1748 g batch, scaled to 750 g.
    expect(flour.toDecimalPlaces(0).toString()).toBe('429')
    expect(water.toDecimalPlaces(0).toString()).toBe('300')
    expect(flour.lessThan(500)).toBe(true)
  })

  it('changes the ingredients, not just the target, when the ball weight changes', () => {
    const at250 = scaleDough(iacopelliPoolish, 3, 250)
    const at300 = scaleDough(iacopelliPoolish, 3, 300)

    expect(at300.targetTotalG.toString()).toBe('900')
    const flourAt250 = at250.components.find((c) => c.role === 'flour')!
    const flourAt300 = at300.components.find((c) => c.role === 'flour')!
    expect(flourAt300.grams.greaterThan(flourAt250.grams)).toBe(true)
    expect(flourAt300.grams.dividedBy(flourAt250.grams).toDecimalPlaces(4).toString()).toBe('1.2')
  })

  it('keeps a range a range, and surrounds the target with the scaled total', () => {
    const scaled = scaleDough(iacopelliPoolish, 3, 250)
    const salt = scaled.components.find((c) => c.role === 'salt')!
    expect(salt.mass.min.equals(salt.mass.max)).toBe(false)

    // The rounded total is a range whose bounds straddle the requested mass.
    expect(scaled.achievedTotal.min.lessThanOrEqualTo(750)).toBe(true)
    expect(scaled.achievedTotal.max.greaterThanOrEqualTo(750)).toBe(true)
    expect(withinTolerance(scaled)).toBe(true)
  })

  it('reports a formula with an unstated mandatory weight as incomplete', () => {
    const incomplete: DoughFormula = {
      preferment: 'none',
      components: [
        ...sisofoNeapolitan.components,
        { ingredientId: 'olive-oil', role: 'oil', grams: 0, unknown: true },
      ],
    }
    const scaled = scaleDough(incomplete, 3, 250)
    expect(scaled.complete).toBe(false)
    // No grams are invented for the missing line.
    expect(scaled.components.find((c) => c.role === 'oil')!.grams.isZero()).toBe(true)
    expect(withinTolerance(scaled)).toBe(false)
  })
})

describe('editing hydration', () => {
  it('holds the total dough mass while moving flour and water', () => {
    const before = computeBakersPercentages(sisofoNeapolitan)
    const wetter = withHydration(sisofoNeapolitan, 70)
    const after = computeBakersPercentages(wetter)

    expect(after.hydrationPct.nominal.toDecimalPlaces(4).toString()).toBe('70')
    expect(after.totalDoughG.minus(before.totalDoughG).abs().lessThan('0.0001')).toBe(true)
    expect(after.totalFlourG.lessThan(before.totalFlourG)).toBe(true)
  })

  it('preserves every other percentage relative to flour', () => {
    const before = computeBakersPercentages(sisofoNeapolitan)
    const after = computeBakersPercentages(withHydration(sisofoNeapolitan, 75))

    expect(after.saltPct.nominal.toDecimalPlaces(6).toString()).toBe(
      before.saltPct.nominal.toDecimalPlaces(6).toString(),
    )
    expect(after.yeastPct.nominal.toDecimalPlaces(6).toString()).toBe(
      before.yeastPct.nominal.toDecimalPlaces(6).toString(),
    )
  })

  it('leaves the preferment share of the formula where it was', () => {
    const before = computeBakersPercentages(iacopelliPoolish)
    const after = computeBakersPercentages(withHydration(iacopelliPoolish, 65))

    expect(after.prefermentFlourPct.nominal.toDecimalPlaces(4).toString()).toBe(
      before.prefermentFlourPct.nominal.toDecimalPlaces(4).toString(),
    )

    // The poolish keeps its share of the water too.
    const waterShare = (formula: DoughFormula) => {
      const components = formula.components.filter((c) => c.role === 'water')
      const total = components.reduce((sum, c) => sum.plus(new Decimal(c.grams)), new Decimal(0))
      const preferment = components
        .filter((c) => c.stage === 'preferment')
        .reduce((sum, c) => sum.plus(new Decimal(c.grams)), new Decimal(0))
      return preferment.dividedBy(total).toDecimalPlaces(6).toString()
    }
    expect(waterShare(withHydration(iacopelliPoolish, 65))).toBe(waterShare(iacopelliPoolish))
  })

  it('keeps a stated range a range after rehydrating', () => {
    const after = withHydration(iacopelliPoolish, 65)
    const salt = after.components.find((c) => c.role === 'salt')!
    expect(salt.gramsMin).toBeDefined()
    expect(salt.gramsMax).toBeDefined()
    expect(String(salt.gramsMin)).not.toBe(String(salt.gramsMax))
  })

  it('still lands on the requested mass after rehydrating', () => {
    const scaled = scaleDough(withHydration(sisofoNeapolitan, 70), 3, 300)
    expect(scaled.targetTotalG.toString()).toBe('900')
    expect(withinTolerance(scaled)).toBe(true)
  })

  it('rejects an implausible hydration without clamping it', () => {
    expect(isPlausibleHydration(65)).toBe(true)
    expect(isPlausibleHydration(0)).toBe(false)
    expect(isPlausibleHydration(500)).toBe(false)
    expect(isPlausibleHydration(Number.NaN)).toBe(false)
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
    expect(p.hydrationPct.nominal.toString()).toBe('65')
    expect(p.saltPct.nominal.toString()).toBe('2.8')
  })
})
