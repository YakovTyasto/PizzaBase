import { Decimal } from 'decimal.js'

/**
 * Baker's percentages: every ingredient is expressed relative to total flour,
 * which is by definition 100%. All dough maths in the app goes through here so
 * that hydration shown in the UI and grams shown on the shopping list can never
 * drift apart.
 */
export type DoughRole =
  | 'flour'
  | 'water'
  | 'salt'
  | 'yeast'
  | 'oil'
  | 'sugar'
  | 'honey'
  | 'starter'
  | 'other'

export type PrefermentKind = 'none' | 'poolish' | 'biga' | 'sourdough'

export interface DoughComponent {
  ingredientId: string
  role: DoughRole
  /** Grams in the reference formula. */
  grams: Decimal.Value
  /** Which stage this belongs to, for poolish/biga recipes. */
  stage?: 'preferment' | 'final'
}

export interface DoughFormula {
  preferment: PrefermentKind
  components: DoughComponent[]
}

export interface BakersPercentages {
  totalFlourG: Decimal
  totalDoughG: Decimal
  hydrationPct: Decimal
  saltPct: Decimal
  yeastPct: Decimal
  oilPct: Decimal
  sugarPct: Decimal
  /** Share of the total flour that sits in the preferment. */
  prefermentFlourPct: Decimal
  byIngredient: { ingredientId: string; role: DoughRole; grams: Decimal; percent: Decimal }[]
}

export class DoughError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DoughError'
  }
}

function sumRole(components: readonly DoughComponent[], role: DoughRole): Decimal {
  return components.reduce(
    (acc, c) => (c.role === role ? acc.plus(new Decimal(c.grams)) : acc),
    new Decimal(0),
  )
}

export function computeBakersPercentages(formula: DoughFormula): BakersPercentages {
  const totalFlourG = sumRole(formula.components, 'flour')
  if (totalFlourG.lessThanOrEqualTo(0)) {
    throw new DoughError('A dough formula needs a positive flour weight')
  }
  const pct = (grams: Decimal) => grams.dividedBy(totalFlourG).times(100)

  const totalDoughG = formula.components.reduce(
    (acc, c) => acc.plus(new Decimal(c.grams)),
    new Decimal(0),
  )
  const prefermentFlour = formula.components.reduce(
    (acc, c) =>
      c.role === 'flour' && c.stage === 'preferment' ? acc.plus(new Decimal(c.grams)) : acc,
    new Decimal(0),
  )

  return {
    totalFlourG,
    totalDoughG,
    hydrationPct: pct(sumRole(formula.components, 'water')),
    saltPct: pct(sumRole(formula.components, 'salt')),
    yeastPct: pct(sumRole(formula.components, 'yeast')),
    oilPct: pct(sumRole(formula.components, 'oil')),
    sugarPct: pct(sumRole(formula.components, 'sugar')),
    prefermentFlourPct: pct(prefermentFlour),
    byIngredient: formula.components.map((c) => {
      const grams = new Decimal(c.grams)
      return { ingredientId: c.ingredientId, role: c.role, grams, percent: pct(grams) }
    }),
  }
}

export interface ScaledDough {
  targetTotalG: Decimal
  /** Sum of the rounded per-ingredient weights actually shown to the user. */
  achievedTotalG: Decimal
  ballCount: number
  ballWeightG: Decimal
  percentages: BakersPercentages
  components: {
    ingredientId: string
    role: DoughRole
    stage: 'preferment' | 'final'
    grams: Decimal
    /** Rounded for display; small ingredients keep more decimals. */
    displayGrams: Decimal
    percent: Decimal
  }[]
}

/**
 * Rounds a weight to a sensible precision for the kitchen: 0.01 g under a gram
 * (yeast), 0.1 g under ten grams (salt), whole grams above that.
 */
export function roundForKitchen(grams: Decimal): Decimal {
  const abs = grams.abs()
  if (abs.lessThan(1)) return grams.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  if (abs.lessThan(10)) return grams.toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
  return grams.toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
}

/**
 * Scales a dough formula to `ballCount` balls of `ballWeightG` each, preserving
 * every baker's percentage exactly. Rounding happens only on the way out, and
 * the residual drift is reported as `achievedTotalG` so the UI can show how
 * close the rounded recipe lands to the requested mass.
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
  const targetTotalG = ballWeight.times(ballCount)
  const factor = targetTotalG.dividedBy(percentages.totalDoughG)

  const components = formula.components.map((c) => {
    const grams = new Decimal(c.grams).times(factor)
    return {
      ingredientId: c.ingredientId,
      role: c.role,
      stage: c.stage ?? ('final' as const),
      grams,
      displayGrams: roundForKitchen(grams),
      percent: grams.dividedBy(percentages.totalFlourG.times(factor)).times(100),
    }
  })

  return {
    targetTotalG,
    achievedTotalG: components.reduce((acc, c) => acc.plus(c.displayGrams), new Decimal(0)),
    ballCount,
    ballWeightG: ballWeight,
    percentages,
    components,
  }
}

/**
 * Builds a formula from percentages instead of grams — the path used by the
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
