import { Decimal } from 'decimal.js'
import { type Amount, isNumeric } from './amount'
import type { MassRange } from './dough'
import type { DomainRecipe, Shape } from './model'
import { areConvertible, convert, measureOf } from './units'

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
 * What one unscaled batch of a recipe weighs, read from its own amounts.
 *
 * This is the denominator every exact dough scale factor is built on, and it
 * exists precisely so that a missing `baseYield` cannot be mistaken for "the
 * entire source batch makes one pizza". A stated range keeps both bounds; a
 * qualitative or unstated mandatory amount leaves the batch mass incomplete
 * rather than inventing grams for it.
 */
export interface SourceBatchMass extends MassRange {
  /** False when a mandatory amount was qualitative, unknown or unweighable. */
  complete: boolean
  /** Item ids whose mass could not be established. */
  unknownItemIds: string[]
}

/** Converts an amount to grams, or null when it is not a weighable mass. */
function gramsOf(amount: Amount): { min: Decimal; max: Decimal } | null {
  if (!isNumeric(amount)) return null
  if (measureOf(amount.unit) !== 'mass' || !areConvertible(amount.unit, 'g')) return null
  return amount.kind === 'exact'
    ? { min: convert(amount.value, amount.unit, 'g'), max: convert(amount.value, amount.unit, 'g') }
    : { min: convert(amount.min, amount.unit, 'g'), max: convert(amount.max, amount.unit, 'g') }
}

export function sourceBatchMass(recipe: DomainRecipe): SourceBatchMass {
  let min = new Decimal(0)
  let nominal = new Decimal(0)
  let max = new Decimal(0)
  const unknownItemIds: string[] = []

  for (const item of recipe.items) {
    const grams = gramsOf(item.amount)
    if (!grams) {
      // An optional garnish left unstated does not make the batch mass a
      // guess; a mandatory line does.
      if (!item.optional) unknownItemIds.push(item.id)
      continue
    }
    min = min.plus(grams.min)
    max = max.plus(grams.max)
    nominal = nominal.plus(grams.min.plus(grams.max).dividedBy(2))
  }

  return {
    min,
    nominal,
    max,
    complete: unknownItemIds.length === 0 && nominal.greaterThan(0),
    unknownItemIds,
  }
}

/**
 * Dough scales by target mass, independently of the topping factor: the user
 * picks how many balls and how heavy each one is.
 *
 * The factor is `target mass / source batch mass`, both in grams, which is
 * exact whenever the recipe states its ingredient weights -- no base yield
 * required. `baseYield` and `baseBallWeightG` only supply defaults: the ball
 * weight to use when the caller does not name one, and the count fallback for
 * a recipe whose ingredient weights cannot be summed at all.
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

  const batch = sourceBatchMass(input.baseRecipe)
  if (batch.nominal.greaterThan(0) && targetBall && targetBall.greaterThan(0)) {
    return new Decimal(input.targetBallCount).times(targetBall).dividedBy(batch.nominal)
  }

  // Nothing weighable to scale from: fall back to counting pizzas, and to the
  // ratio of ball weights when the recipe states one.
  const countFactor = new Decimal(input.targetBallCount).dividedBy(basePizzas)
  if (!baseBall || !targetBall || baseBall.isZero()) return countFactor
  return countFactor.times(targetBall.dividedBy(baseBall))
}
