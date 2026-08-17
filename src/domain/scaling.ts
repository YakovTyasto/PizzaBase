import { Decimal } from 'decimal.js'
import type { DomainRecipe, Shape } from './model'

/**
 * How toppings follow a change of pizza size.
 *
 * `area` is the physically correct choice — a 40 cm pizza has 1.78x the surface
 * of a 30 cm one, not 1.33x — but the user is allowed to override it because
 * some people genuinely want "same as before, just more pizzas".
 */
export type ToppingScaleMode = 'area' | 'portion'

export interface SizeSpec {
  shape: Shape
  diameterMm?: number | null
  trayWidthMm?: number | null
  trayHeightMm?: number | null
}

export class ScalingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScalingError'
  }
}

export function areaOf(size: SizeSpec): Decimal {
  if (size.shape === 'round') {
    if (!size.diameterMm || size.diameterMm <= 0) {
      throw new ScalingError('A round pizza needs a positive diameter')
    }
    // The pi factor cancels in every ratio we take, but keeping it makes the
    // returned value a real area in mm² for anything that displays it.
    const r = new Decimal(size.diameterMm).dividedBy(2)
    return r.times(r).times(Decimal.acos(-1))
  }
  if (!size.trayWidthMm || !size.trayHeightMm || size.trayWidthMm <= 0 || size.trayHeightMm <= 0) {
    throw new ScalingError('A rectangular pizza needs positive tray dimensions')
  }
  return new Decimal(size.trayWidthMm).times(size.trayHeightMm)
}

/** Ratio of target surface to base surface. Round: (target/base)². */
export function areaFactor(base: SizeSpec, target: SizeSpec): Decimal {
  return areaOf(target).dividedBy(areaOf(base))
}

export interface ToppingScaleInput {
  mode: ToppingScaleMode
  /** How many pizzas the base recipe makes (its yield in pizzas). */
  basePizzaCount: Decimal.Value
  targetPizzaCount: Decimal.Value
  baseSize?: SizeSpec | null
  targetSize?: SizeSpec | null
}

/**
 * Total topping factor for a batch: how many pizzas, times how much bigger each
 * one is. In `portion` mode the size ratio is ignored entirely.
 */
export function toppingFactor(input: ToppingScaleInput): Decimal {
  const basePizzas = new Decimal(input.basePizzaCount)
  if (basePizzas.lessThanOrEqualTo(0)) {
    throw new ScalingError('Base pizza count must be positive')
  }
  const countFactor = new Decimal(input.targetPizzaCount).dividedBy(basePizzas)
  if (input.mode === 'portion') return countFactor
  if (!input.baseSize || !input.targetSize) return countFactor
  return countFactor.times(areaFactor(input.baseSize, input.targetSize))
}

export function baseSizeOf(recipe: DomainRecipe): SizeSpec | null {
  if (!recipe.baseShape) return null
  return {
    shape: recipe.baseShape,
    diameterMm: recipe.baseDiameterMm,
    trayWidthMm: recipe.baseTrayWidthMm,
    trayHeightMm: recipe.baseTrayHeightMm,
  }
}

/**
 * Dough scales by target mass, independently of the topping factor: the user
 * picks how many balls and how heavy each one is. When no ball weight is given
 * we fall back to the recipe's own base ball weight, and if the recipe does not
 * state one either, dough simply follows the pizza count.
 */
export function doughFactor(input: {
  baseRecipe: DomainRecipe
  basePizzaCount: Decimal.Value
  targetBallCount: Decimal.Value
  targetBallWeightG?: Decimal.Value | null
}): Decimal {
  const basePizzas = new Decimal(input.basePizzaCount)
  if (basePizzas.lessThanOrEqualTo(0)) {
    throw new ScalingError('Base pizza count must be positive')
  }
  const baseBall = input.baseRecipe.baseBallWeightG
  const targetBall =
    input.targetBallWeightG === null || input.targetBallWeightG === undefined
      ? baseBall
      : new Decimal(input.targetBallWeightG)

  const countFactor = new Decimal(input.targetBallCount).dividedBy(basePizzas)
  if (!baseBall || !targetBall || baseBall.isZero()) return countFactor
  return countFactor.times(targetBall.dividedBy(baseBall))
}
