import { Decimal } from 'decimal.js'

/**
 * Baker's percentages: every ingredient is expressed relative to total flour,
 * which is by definition 100%. All dough maths in the app goes through here so
 * that hydration shown in the UI and grams shown on the shopping list can never
 * drift apart.
 */
export type DoughRole =
  'flour' | 'water' | 'salt' | 'yeast' | 'oil' | 'sugar' | 'honey' | 'starter' | 'other'

export type PrefermentKind = 'none' | 'poolish' | 'biga' | 'sourdough'

export interface DoughComponent {
  ingredientId: string
  role: DoughRole
  /**
   * Grams in the reference formula. When the source stated a range this is the
   * documented nominal reference -- the midpoint of `gramsMin`..`gramsMax`.
   */
  grams: Decimal.Value
  /** Set only when the source stated a range; `grams` is then the midpoint. */
  gramsMin?: Decimal.Value
  gramsMax?: Decimal.Value
  /**
   * The source never stated a weight for this line. It contributes nothing to
   * the reference mass and marks the formula incomplete, rather than being
   * silently treated as zero grams.
   */
  unknown?: boolean
  /** Which stage this belongs to, for poolish/biga recipes. */
  stage?: 'preferment' | 'final'
}

export interface DoughFormula {
  preferment: PrefermentKind
  components: DoughComponent[]
}

/**
 * A mass that may be a stated range.
 *
 * `nominal` is the single figure used wherever one number is required -- the
 * midpoint for a range -- while `min` and `max` preserve what the source
 * actually said, so a scaled total range still surrounds the requested target.
 */
export interface MassRange {
  min: Decimal
  nominal: Decimal
  max: Decimal
}

/** A baker's percentage that may itself be a range, e.g. salt at 2.5-3%. */
export interface PercentValue {
  min: Decimal
  nominal: Decimal
  max: Decimal
}

export function isPercentRange(percent: PercentValue): boolean {
  return !percent.min.equals(percent.max)
}

export function isMassRange(mass: MassRange): boolean {
  return !mass.min.equals(mass.max)
}

export interface BakersPercentages {
  /** Nominal total flour; `totalFlour` carries the range it came from. */
  totalFlourG: Decimal
  totalFlour: MassRange
  /** Nominal total dough mass of the reference batch. */
  totalDoughG: Decimal
  totalDough: MassRange
  hydrationPct: PercentValue
  saltPct: PercentValue
  yeastPct: PercentValue
  oilPct: PercentValue
  sugarPct: PercentValue
  /** Share of the total flour that sits in the preferment. */
  prefermentFlourPct: PercentValue
  /**
   * Ingredient ids whose weight the source never stated. While this is
   * non-empty the percentages describe only the part of the formula that is
   * known, and `complete` is false.
   */
  unknownComponents: string[]
  complete: boolean
  byIngredient: {
    ingredientId: string
    role: DoughRole
    grams: Decimal
    mass: MassRange
    unknown: boolean
    percent: PercentValue
  }[]
}

export class DoughError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DoughError'
  }
}

const ZERO_MASS: MassRange = {
  min: new Decimal(0),
  nominal: new Decimal(0),
  max: new Decimal(0),
}

/**
 * The mass one component contributes.
 *
 * A range keeps both bounds and takes its midpoint as the nominal reference; an
 * unstated weight contributes nothing at all rather than a made-up zero that
 * would quietly pass for a real measurement.
 */
export function componentMass(component: DoughComponent): MassRange {
  if (component.unknown) return ZERO_MASS
  if (component.gramsMin !== undefined && component.gramsMax !== undefined) {
    const a = new Decimal(component.gramsMin)
    const b = new Decimal(component.gramsMax)
    const min = a.lessThanOrEqualTo(b) ? a : b
    const max = a.lessThanOrEqualTo(b) ? b : a
    return { min, nominal: min.plus(max).dividedBy(2), max }
  }
  const value = new Decimal(component.grams)
  return { min: value, nominal: value, max: value }
}

function addMass(a: MassRange, b: MassRange): MassRange {
  return {
    min: a.min.plus(b.min),
    nominal: a.nominal.plus(b.nominal),
    max: a.max.plus(b.max),
  }
}

function sumMass(
  components: readonly DoughComponent[],
  predicate: (component: DoughComponent) => boolean,
): MassRange {
  return components.reduce(
    (acc, component) => (predicate(component) ? addMass(acc, componentMass(component)) : acc),
    ZERO_MASS,
  )
}

function scaleMass(mass: MassRange, factor: Decimal): MassRange {
  return {
    min: mass.min.times(factor),
    nominal: mass.nominal.times(factor),
    max: mass.max.times(factor),
  }
}

/**
 * Interval arithmetic for a percentage.
 *
 * The lowest possible percentage pairs the smallest part with the largest flour
 * weight and vice versa, so a range never collapses to a point -- and, above
 * all, never collapses to zero.
 */
function percentOf(part: MassRange, flour: MassRange): PercentValue {
  const safe = (value: Decimal, divisor: Decimal) =>
    divisor.greaterThan(0) ? value.dividedBy(divisor).times(100) : new Decimal(0)
  return {
    min: safe(part.min, flour.max),
    nominal: safe(part.nominal, flour.nominal),
    max: safe(part.max, flour.min),
  }
}

/** The total mass of one reference batch, straight from its own amounts. */
export function referenceBatchMass(formula: DoughFormula): MassRange {
  return sumMass(formula.components, () => true)
}

export function computeBakersPercentages(formula: DoughFormula): BakersPercentages {
  const totalFlour = sumMass(formula.components, (c) => c.role === 'flour')
  if (totalFlour.nominal.lessThanOrEqualTo(0)) {
    throw new DoughError('A dough formula needs a positive flour weight')
  }

  const totalDough = referenceBatchMass(formula)
  const unknownComponents = formula.components
    .filter((component) => component.unknown)
    .map((component) => component.ingredientId)

  const byRole = (role: DoughRole) =>
    percentOf(
      sumMass(formula.components, (c) => c.role === role),
      totalFlour,
    )

  return {
    totalFlourG: totalFlour.nominal,
    totalFlour,
    totalDoughG: totalDough.nominal,
    totalDough,
    hydrationPct: byRole('water'),
    saltPct: byRole('salt'),
    yeastPct: byRole('yeast'),
    oilPct: byRole('oil'),
    sugarPct: byRole('sugar'),
    prefermentFlourPct: percentOf(
      sumMass(formula.components, (c) => c.role === 'flour' && c.stage === 'preferment'),
      totalFlour,
    ),
    unknownComponents,
    complete: unknownComponents.length === 0,
    byIngredient: formula.components.map((component) => {
      const mass = componentMass(component)
      return {
        ingredientId: component.ingredientId,
        role: component.role,
        grams: mass.nominal,
        mass,
        unknown: Boolean(component.unknown),
        percent: percentOf(mass, totalFlour),
      }
    }),
  }
}

export interface ScaledDoughComponent {
  ingredientId: string
  role: DoughRole
  stage: 'preferment' | 'final'
  /** Nominal scaled weight, unrounded. */
  grams: Decimal
  /** Scaled weight range; both bounds equal for an exactly stated amount. */
  mass: MassRange
  /** Rounded for display; small ingredients keep more decimals. */
  displayGrams: Decimal
  displayMass: MassRange
  unknown: boolean
  percent: PercentValue
}

export interface ScaledDough {
  targetTotalG: Decimal
  /** Sum of the rounded per-ingredient weights actually shown to the user. */
  achievedTotalG: Decimal
  /** The same sum as a range, which must surround `targetTotalG`. */
  achievedTotal: MassRange
  /** Mass of the source batch the scale factor was derived from. */
  sourceBatch: MassRange
  factor: Decimal
  ballCount: number
  ballWeightG: Decimal
  percentages: BakersPercentages
  /** False when any mandatory weight was never stated by the source. */
  complete: boolean
  components: ScaledDoughComponent[]
}

/**
 * The precision a weight is shown at in the kitchen: 0.01 g under a gram
 * (yeast), 0.1 g under ten grams (salt), whole grams above that.
 */
export function roundingStep(grams: Decimal): Decimal {
  const abs = grams.abs()
  if (abs.lessThan(1)) return new Decimal('0.01')
  if (abs.lessThan(10)) return new Decimal('0.1')
  return new Decimal(1)
}

export function roundForKitchen(grams: Decimal): Decimal {
  const abs = grams.abs()
  if (abs.lessThan(1)) return grams.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  if (abs.lessThan(10)) return grams.toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
  return grams.toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
}

/**
 * How far the displayed ingredient total may sit from the requested mass.
 *
 * Not a guess and not a percentage: rounding each line to the precision a
 * kitchen scale can actually read moves it by at most half a step, so the sum
 * can move by at most half a step per line. That total is the tolerance, and it
 * is what lets the UI state plainly whether the figures on screen agree --
 * rather than leaving two numbers to disagree silently.
 */
export function roundingToleranceG(scaled: ScaledDough): Decimal {
  return scaled.components.reduce(
    (acc, component) => acc.plus(roundingStep(component.grams).dividedBy(2)),
    new Decimal(0),
  )
}

/** True when the rounded total agrees with the target within that tolerance. */
export function withinTolerance(scaled: ScaledDough): boolean {
  if (!scaled.complete) return false
  return scaled.achievedTotalG
    .minus(scaled.targetTotalG)
    .abs()
    .lessThanOrEqualTo(roundingToleranceG(scaled))
}

/**
 * Scales a dough formula to `ballCount` balls of `ballWeightG` each.
 *
 * The scale factor comes from the formula's *own* reference mass -- the sum of
 * the amounts the source stated -- and never from a base yield. A recipe that
 * does not say how many balls it makes is still exactly scalable, because the
 * grams it lists are enough on their own. A missing yield must never be read as
 * "the whole batch is one pizza".
 *
 * A stated range keeps both bounds, so the scaled total range surrounds the
 * requested target instead of claiming a precision the source never had.
 */
export function scaleDough(
  formula: DoughFormula,
  ballCount: number,
  ballWeightG: Decimal.Value,
): ScaledDough {
  if (!Number.isInteger(ballCount) || ballCount <= 0) {
    throw new DoughError('Ball count must be a positive whole number')
  }
  const ballWeight = new Decimal(ballWeightG)
  if (ballWeight.lessThanOrEqualTo(0)) {
    throw new DoughError('Ball weight must be positive')
  }

  const percentages = computeBakersPercentages(formula)
  const sourceBatch = percentages.totalDough
  if (sourceBatch.nominal.lessThanOrEqualTo(0)) {
    throw new DoughError('A dough formula needs a positive reference mass to scale from')
  }

  const targetTotalG = ballWeight.times(ballCount)
  const factor = targetTotalG.dividedBy(sourceBatch.nominal)
  const scaledFlour = scaleMass(percentages.totalFlour, factor)

  const components: ScaledDoughComponent[] = formula.components.map((component) => {
    const scaled = scaleMass(componentMass(component), factor)
    return {
      ingredientId: component.ingredientId,
      role: component.role,
      stage: component.stage ?? ('final' as const),
      grams: scaled.nominal,
      mass: scaled,
      displayGrams: roundForKitchen(scaled.nominal),
      displayMass: {
        min: roundForKitchen(scaled.min),
        nominal: roundForKitchen(scaled.nominal),
        max: roundForKitchen(scaled.max),
      },
      unknown: Boolean(component.unknown),
      percent: percentOf(scaled, scaledFlour),
    }
  })

  const achievedTotal = components.reduce<MassRange>(
    (acc, component) => addMass(acc, component.displayMass),
    ZERO_MASS,
  )

  return {
    targetTotalG,
    achievedTotalG: achievedTotal.nominal,
    achievedTotal,
    sourceBatch,
    factor,
    ballCount,
    ballWeightG: ballWeight,
    percentages,
    complete: percentages.complete,
    components,
  }
}

/** Bounds a typed hydration has to sit inside to be worth calculating with. */
export const MIN_HYDRATION_PCT = 30
export const MAX_HYDRATION_PCT = 120

export function isPlausibleHydration(value: Decimal.Value): boolean {
  let hydration: Decimal
  try {
    hydration = new Decimal(value)
  } catch {
    return false
  }
  return (
    hydration.isFinite() &&
    hydration.greaterThanOrEqualTo(MIN_HYDRATION_PCT) &&
    hydration.lessThanOrEqualTo(MAX_HYDRATION_PCT)
  )
}

/**
 * Rewrites a formula at a different hydration, keeping the total dough mass and
 * every other baker's percentage exactly where they were.
 *
 * With flour F, hydration h and the remaining ingredients summing to k percent
 * of flour, the batch weighs F*(1 + h + k). Holding that total fixed gives
 * F = total / (1 + h + k), and everything else follows from F. Flour and water
 * keep their original split across the preferment and the final dough, so a
 * poolish stays the same share of the formula unless the user changes it.
 */
export function withHydration(formula: DoughFormula, hydrationPct: Decimal.Value): DoughFormula {
  const hydration = new Decimal(hydrationPct)
  if (!hydration.isFinite() || hydration.lessThan(0)) {
    throw new DoughError('Hydration must be a positive percentage')
  }

  const flour = sumMass(formula.components, (c) => c.role === 'flour')
  const water = sumMass(formula.components, (c) => c.role === 'water')
  if (flour.nominal.lessThanOrEqualTo(0)) {
    throw new DoughError('A dough formula needs a positive flour weight')
  }

  const total = referenceBatchMass(formula)
  const othersRatio = total.nominal
    .minus(flour.nominal)
    .minus(water.nominal)
    .dividedBy(flour.nominal)
  const hydrationRatio = hydration.dividedBy(100)

  const nextFlour = total.nominal.dividedBy(new Decimal(1).plus(hydrationRatio).plus(othersRatio))
  const flourScale = nextFlour.dividedBy(flour.nominal)
  // A formula with no water at all has no split to redistribute the new water
  // across, so its water lines are left exactly as they were.
  const waterScale = water.nominal.greaterThan(0)
    ? nextFlour.times(hydrationRatio).dividedBy(water.nominal)
    : null

  return {
    preferment: formula.preferment,
    components: formula.components.map((component) => {
      if (component.unknown) return component
      const scale = component.role === 'water' ? waterScale : flourScale
      if (!scale) return component
      const rescale = (value: Decimal.Value) => new Decimal(value).times(scale).toString()
      return {
        ...component,
        grams: rescale(component.grams),
        ...(component.gramsMin !== undefined ? { gramsMin: rescale(component.gramsMin) } : {}),
        ...(component.gramsMax !== undefined ? { gramsMax: rescale(component.gramsMax) } : {}),
      }
    }),
  }
}

/**
 * Builds a formula from percentages instead of grams -- the path used by the
 * "I want 65% hydration" editor.
 */
export function formulaFromPercentages(input: {
  flourIngredientId: string
  waterIngredientId: string
  saltIngredientId: string
  yeastIngredientId: string
  oilIngredientId?: string | null
  flourG: Decimal.Value
  hydrationPct: Decimal.Value
  saltPct: Decimal.Value
  yeastPct: Decimal.Value
  oilPct?: Decimal.Value | null
  preferment?: PrefermentKind
}): DoughFormula {
  const flour = new Decimal(input.flourG)
  const fromPct = (p: Decimal.Value) => flour.times(new Decimal(p)).dividedBy(100)

  const components: DoughComponent[] = [
    { ingredientId: input.flourIngredientId, role: 'flour', grams: flour },
    { ingredientId: input.waterIngredientId, role: 'water', grams: fromPct(input.hydrationPct) },
    { ingredientId: input.saltIngredientId, role: 'salt', grams: fromPct(input.saltPct) },
    { ingredientId: input.yeastIngredientId, role: 'yeast', grams: fromPct(input.yeastPct) },
  ]
  if (input.oilIngredientId && input.oilPct) {
    components.push({
      ingredientId: input.oilIngredientId,
      role: 'oil',
      grams: fromPct(input.oilPct),
    })
  }
  return { preferment: input.preferment ?? 'none', components }
}
