import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { recipe } from './__fixtures__/graph'
import { ScalingError, areaFactor, doughFactor, toppingFactor } from './scaling'

describe('size scaling', () => {
  it('scales round toppings by area, not diameter', () => {
    const f = areaFactor(
      { shape: 'round', diameterMm: 300 },
      { shape: 'round', diameterMm: 400 },
    )
    // (400/300)^2 = 1.777..., emphatically not 1.333...
    expect(f.toDecimalPlaces(4).toString()).toBe('1.7778')
    expect(f.toNumber()).toBeGreaterThan(400 / 300)
  })

  it('scales a rectangular tray by the ratio of areas', () => {
    const f = areaFactor(
      { shape: 'rectangular', trayWidthMm: 300, trayHeightMm: 200 },
      { shape: 'rectangular', trayWidthMm: 400, trayHeightMm: 300 },
    )
    // 120000 / 60000
    expect(f.toString()).toBe('2')
  })

  it('rejects a round size with no diameter', () => {
    expect(() => areaFactor({ shape: 'round' }, { shape: 'round', diameterMm: 300 })).toThrow(
      ScalingError,
    )
  })

  it('combines count and area in area mode', () => {
    const f = toppingFactor({
      mode: 'area',
      basePizzaCount: 1,
      targetPizzaCount: 3,
      baseSize: { shape: 'round', diameterMm: 300 },
      targetSize: { shape: 'round', diameterMm: 400 },
    })
    expect(f.toDecimalPlaces(4).toString()).toBe('5.3333')
  })

  it('ignores size in portion mode', () => {
    const f = toppingFactor({
      mode: 'portion',
      basePizzaCount: 1,
      targetPizzaCount: 3,
      baseSize: { shape: 'round', diameterMm: 300 },
      targetSize: { shape: 'round', diameterMm: 400 },
    })
    expect(f.toString()).toBe('3')
  })
})

describe('dough scaling', () => {
  const base = recipe('dough', [], {
    type: 'dough',
    baseBallWeightG: new Decimal(250),
    baseYield: new Decimal(3),
    yieldUnit: 'piece',
  })

  it('scales dough by ball count and ball weight independently of toppings', () => {
    const f = doughFactor({
      baseRecipe: base,
      basePizzaCount: 3,
      targetBallCount: 6,
      targetBallWeightG: 300,
    })
    // twice the balls, each 300/250 heavier
    expect(f.toString()).toBe('2.4')
  })

  it("falls back to the recipe's own ball weight when none is given", () => {
    const f = doughFactor({ baseRecipe: base, basePizzaCount: 3, targetBallCount: 6 })
    expect(f.toString()).toBe('2')
  })

  it('follows pizza count when the recipe states no ball weight', () => {
    const noBall = recipe('dough2', [], { type: 'dough', baseYield: new Decimal(2) })
    const f = doughFactor({
      baseRecipe: noBall,
      basePizzaCount: 2,
      targetBallCount: 5,
      targetBallWeightG: 300,
    })
    expect(f.toString()).toBe('2.5')
  })
})
