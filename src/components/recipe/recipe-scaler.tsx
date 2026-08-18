'use client'

import { Decimal } from 'decimal.js'
import { AlertTriangle, ChevronDown, Info, RotateCcw } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import {
  type Amount,
  type DoughFormula,
  type MassRange,
  type ScaledDough,
  type ToppingScaleMode,
  MAX_HYDRATION_PCT,
  MIN_HYDRATION_PCT,
  RecipeCycleError,
  aggregateLines,
  computeBakersPercentages,
  doughFactor,
  expandRecipe,
  isPlausibleHydration,
  scaleDough,
  roundingToleranceG,
  toppingFactor,
  withHydration,
  withinTolerance,
} from '@/domain'
import { AmountDisplay } from '@/components/recipe/amount-display'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardBody,
  DataRow,
  Label,
  NumericInput,
  SectionHeading,
} from '@/components/ui/primitives'
import type { RecipeDetail } from '@/lib/data/types'
import { type WireGraph, deserializeGraph } from '@/lib/data/serialize'
import { formatDecimal, formatPercentValue } from '@/lib/format'
import { cn } from '@/lib/utils'
import { doughFormulaFor } from './dough-formula'

/**
 * Live scaling.
 *
 * Everything here calls the same pure functions the server and the tests use.
 * There is no second implementation of the arithmetic in the UI, which is what
 * guarantees the number on screen matches the number on the shopping list.
 */

/** A typed field that keeps what the user actually typed. */
interface NumberField {
  text: string
  /** The last value that passed validation; calculations use this. */
  value: number
  /** Set while the text does not parse or sits outside the allowed range. */
  invalid: boolean
}

function field(value: number): NumberField {
  return { text: String(value), value, invalid: false }
}

/**
 * Accepts a typed number without rewriting it.
 *
 * Silently clamping as someone types makes "30" impossible to reach from "300"
 * -- the first backspace snaps the value back. So the text is kept exactly as
 * entered, the last valid number keeps driving the calculation, and the field
 * says what is wrong.
 */
function parseField(
  text: string,
  previous: NumberField,
  check: (value: number) => boolean,
): NumberField {
  const normalized = text.replace(',', '.').trim()
  const parsed = Number(normalized)
  const valid = normalized !== '' && Number.isFinite(parsed) && check(parsed)
  return { text, value: valid ? parsed : previous.value, invalid: !valid }
}

/** Renders a scaled dough weight through the same amount display as everything else. */
function massAmount(mass: MassRange): Amount {
  return mass.min.equals(mass.max)
    ? { kind: 'exact', value: mass.nominal, unit: 'g' }
    : { kind: 'range', min: mass.min, max: mass.max, unit: 'g' }
}

export function RecipeScaler({
  recipe,
  graph: wireGraph,
  ingredientNames,
  recipeNames,
}: {
  recipe: RecipeDetail
  graph: WireGraph
  ingredientNames: Record<string, string>
  recipeNames: Record<string, string>
}) {
  const t = useTranslations()
  const locale = useLocale()

  const isDough = recipe.type === 'dough'
  const graph = useMemo(() => deserializeGraph(wireGraph), [wireGraph])

  /** The formula exactly as the source states it. */
  const sourceFormula = useMemo(() => doughFormulaFor(recipe), [recipe])

  const sourcePercentages = useMemo(() => {
    if (!sourceFormula) return null
    try {
      return computeBakersPercentages(sourceFormula)
    } catch {
      return null
    }
  }, [sourceFormula])

  /**
   * What the scaler opens on.
   *
   * A stated yield and ball weight win outright. Where the source gives
   * neither, the batch is divided into balls of about the usual size and the
   * weight is then derived back from that division -- so the opening view is
   * the formula *as written*, and the two controls still say something true
   * about it. Nothing is invented: both numbers come from the recipe's own
   * amounts, and every later change scales from the same batch mass.
   */
  const defaults = useMemo(() => {
    const statedBall = Number(recipe.baseBallWeightG ?? 0) || 0
    const statedYield = Number(recipe.baseYield ?? 0) || 0
    const batch = sourcePercentages?.totalDoughG.toNumber() ?? 0
    const tenth = (grams: number) => Math.round(grams * 10) / 10

    // Both stated: the recipe has already answered the question.
    if (statedYield > 0 && statedBall > 0) {
      return { count: Math.round(statedYield), ballWeight: statedBall }
    }
    if (batch <= 0) {
      return { count: statedYield > 0 ? Math.round(statedYield) : 1, ballWeight: statedBall || 250 }
    }
    // A yield but no weight: divide the batch into that many balls.
    if (statedYield > 0) {
      const count = Math.round(statedYield)
      return { count, ballWeight: tenth(batch / count) }
    }
    // Neither: cut the batch into balls of about the usual size, then take the
    // weight back out of that division. Rounding the *count* and keeping the
    // stated ball size would rescale the formula on sight -- a recipe listing
    // 1000 g of flour would open showing 938 g, for no reason the reader can see.
    const preferred = statedBall > 0 ? statedBall : 250
    const count = Math.max(1, Math.round(batch / preferred))
    return { count, ballWeight: tenth(batch / count) }
  }, [recipe.baseBallWeightG, recipe.baseYield, sourcePercentages])

  const basePizzas = Number(recipe.baseYield ?? 1) || 1

  const [count, setCount] = useState(() => field(defaults.count))
  const [diameter, setDiameter] = useState(() => field(recipe.baseDiameterMm ?? 300))
  const [ballWeight, setBallWeight] = useState(() => field(defaults.ballWeight))
  const [mode, setMode] = useState<ToppingScaleMode>('area')
  const [showOrigin, setShowOrigin] = useState<string | null>(null)

  const sourceHydration = sourcePercentages
    ? sourcePercentages.hydrationPct.nominal.toDecimalPlaces(1).toNumber()
    : 0
  const [hydration, setHydration] = useState<NumberField | null>(null)

  /**
   * The formula the screen is actually working from.
   *
   * Untouched, that is the source. Once hydration is edited it is the rewritten
   * formula -- same total mass, same preferment split, same percentages for
   * everything but flour and water.
   */
  const formula: DoughFormula | null = useMemo(() => {
    if (!sourceFormula) return null
    if (!hydration || hydration.value === sourceHydration) return sourceFormula
    try {
      return withHydration(sourceFormula, hydration.value)
    } catch {
      return sourceFormula
    }
  }, [sourceFormula, hydration, sourceHydration])

  const scaled: ScaledDough | null = useMemo(() => {
    if (!isDough || !formula) return null
    try {
      return scaleDough(formula, Math.max(1, Math.round(count.value)), ballWeight.value)
    } catch {
      return null
    }
  }, [isDough, formula, count.value, ballWeight.value])

  // A dough recipe that pulls in another recipe as a component cannot be laid
  // out from the formula alone; it falls back to the general expansion below.
  const hasComponents = recipe.items.some((item) => item.componentRecipeId)
  const useDoughLayout = Boolean(scaled) && !hasComponents

  const factor = useMemo(() => {
    try {
      if (isDough) {
        // The formula is the more precise source of the factor when there is
        // one, because it also accounts for an edited hydration.
        if (scaled) return scaled.factor
        const domainRecipe = graph.recipe(recipe.id)
        if (!domainRecipe) return new Decimal(1)
        return doughFactor({
          baseRecipe: domainRecipe,
          basePizzaCount: basePizzas,
          targetBallCount: count.value,
          targetBallWeightG: ballWeight.value,
        })
      }
      const baseSize =
        recipe.baseShape === 'round' && recipe.baseDiameterMm
          ? ({ shape: 'round', diameterMm: recipe.baseDiameterMm } as const)
          : null
      return toppingFactor({
        mode,
        basePizzaCount: basePizzas,
        targetPizzaCount: count.value,
        baseSize,
        targetSize: baseSize ? { shape: 'round', diameterMm: diameter.value } : null,
      })
    } catch {
      return new Decimal(1)
    }
  }, [
    isDough,
    scaled,
    graph,
    recipe.id,
    recipe.baseShape,
    recipe.baseDiameterMm,
    basePizzas,
    count.value,
    ballWeight.value,
    mode,
    diameter.value,
  ])

  const expansion = useMemo(() => {
    try {
      return expandRecipe(graph, recipe.id, factor)
    } catch (error) {
      if (error instanceof RecipeCycleError) {
        return { lines: [], issues: [], cycle: error.path }
      }
      throw error
    }
  }, [graph, recipe.id, factor])

  const aggregated = useMemo(() => aggregateLines(graph, expansion.lines), [graph, expansion.lines])

  const cyclePath = 'cycle' in expansion ? (expansion.cycle as string[]) : null

  const hydrationEdited = Boolean(hydration && hydration.value !== sourceHydration)
  const bakers = scaled?.percentages ?? sourcePercentages

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-4">
          <SectionHeading>{t('recipe.scale')}</SectionHeading>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="scale-count">
                {isDough ? t('recipe.pizzaCount') : t('plan.count')}
              </Label>
              <NumericInput
                id="scale-count"
                value={count.text}
                aria-invalid={count.invalid || undefined}
                onChange={(event) =>
                  setCount(
                    parseField(
                      event.target.value,
                      count,
                      (value) => Number.isInteger(value) && value >= 1 && value <= 99,
                    ),
                  )
                }
              />
              {count.invalid ? <FieldHint min={1} max={99} /> : null}
            </div>

            {isDough ? (
              <div>
                <Label htmlFor="scale-ball">{t('recipe.ballWeight')}</Label>
                <NumericInput
                  id="scale-ball"
                  decimal
                  value={ballWeight.text}
                  aria-invalid={ballWeight.invalid || undefined}
                  onChange={(event) =>
                    setBallWeight(
                      parseField(
                        event.target.value,
                        ballWeight,
                        (value) => value >= 20 && value <= 3000,
                      ),
                    )
                  }
                />
                {ballWeight.invalid ? <FieldHint min={20} max={3000} /> : null}
              </div>
            ) : recipe.baseShape === 'round' ? (
              <div>
                <Label htmlFor="scale-diameter">{t('recipe.diameter')} (mm)</Label>
                <NumericInput
                  id="scale-diameter"
                  value={diameter.text}
                  aria-invalid={diameter.invalid || undefined}
                  onChange={(event) =>
                    setDiameter(
                      parseField(
                        event.target.value,
                        diameter,
                        (value) => value >= 100 && value <= 800,
                      ),
                    )
                  }
                />
                {diameter.invalid ? <FieldHint min={100} max={800} /> : null}
              </div>
            ) : null}

            {/*
              Hydration is a dough property, so the editor only exists where it
              means something. Changing it holds the target mass and rebalances
              flour against water; everything else keeps its percentage.
            */}
            {useDoughLayout && sourcePercentages ? (
              <div>
                <Label htmlFor="scale-hydration">{t('recipe.hydration')} (%)</Label>
                <div className="flex gap-2">
                  <NumericInput
                    id="scale-hydration"
                    decimal
                    value={hydration ? hydration.text : String(sourceHydration)}
                    aria-invalid={hydration?.invalid || undefined}
                    onChange={(event) =>
                      setHydration(
                        parseField(
                          event.target.value,
                          hydration ?? field(sourceHydration),
                          isPlausibleHydration,
                        ),
                      )
                    }
                  />
                  {hydrationEdited || hydration?.invalid ? (
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={t('recipe.hydrationReset')}
                      title={t('recipe.hydrationReset')}
                      onClick={() => setHydration(null)}
                    >
                      <RotateCcw aria-hidden />
                    </Button>
                  ) : null}
                </div>
                {hydration?.invalid ? (
                  <FieldHint min={MIN_HYDRATION_PCT} max={MAX_HYDRATION_PCT} />
                ) : hydrationEdited ? (
                  <p className="text-amber mt-1 text-xs">
                    {t('recipe.hydrationEdited', { source: sourceHydration })}
                  </p>
                ) : null}
              </div>
            ) : null}

            {!isDough ? (
              <div>
                <Label htmlFor="scale-mode">{t('recipe.scale')}</Label>
                <div className="border-rule flex h-11 items-center gap-1 rounded-lg border p-1">
                  {(['area', 'portion'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setMode(option)}
                      title={option === 'area' ? t('recipe.scaleByAreaHint') : undefined}
                      className={cn(
                        'h-full flex-1 rounded-md px-2 text-xs font-medium transition-colors',
                        mode === option
                          ? 'bg-ink text-paper'
                          : 'text-ink-muted hover:bg-paper-sunken',
                      )}
                    >
                      {option === 'area' ? t('recipe.scaleByArea') : t('recipe.scaleByPortion')}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {!isDough && mode === 'area' && recipe.baseShape === 'round' ? (
            <p className="text-ink-faint flex items-start gap-1.5 text-xs">
              <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {t('recipe.scaleByAreaHint')}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {cyclePath ? (
        <Card className="border-tomato">
          <CardBody className="text-tomato-strong flex items-start gap-2 text-sm">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">{t('errors.cycle')}</p>
              <p className="text-ink-muted mt-0.5">
                {t('errors.cycleHint', {
                  chain: cyclePath.map((id) => recipeNames[id] ?? id).join(' → '),
                })}
              </p>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <section>
        <SectionHeading>{t('recipe.ingredients')}</SectionHeading>
        <Card>
          <CardBody className="space-y-1">
            {useDoughLayout && scaled ? (
              <DoughIngredients scaled={scaled} ingredientNames={ingredientNames} locale={locale} />
            ) : (
              <>
                {aggregated.length === 0 && expansion.issues.length === 0 ? (
                  <p className="text-ink-muted py-2 text-sm">{t('recipes.empty')}</p>
                ) : null}

                <ul className="divide-rule divide-y">
                  {aggregated.map((entry) => {
                    const name = ingredientNames[entry.ingredientId] ?? entry.ingredientId
                    const originId = entry.ingredientId
                    const nested = entry.sources.filter((line) => line.provenance.length > 1)

                    return (
                      <li key={entry.ingredientId} className="py-2.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-ink min-w-0 text-sm">
                            {name}
                            {entry.optional ? (
                              <span className="text-ink-faint ml-1.5 text-xs">
                                ({t('common.optional')})
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-right">
                            {entry.amount ? (
                              <AmountDisplay amount={entry.amount} />
                            ) : (
                              entry.separate
                                .slice(0, 1)
                                .map((line, index) => (
                                  <AmountDisplay key={index} amount={line.amount} />
                                ))
                            )}
                          </span>
                        </div>

                        {/*
                          Provenance drill-down: "tomato is needed for Margherita ->
                          tomato sauce", so a number on the list can always be
                          traced back to the recipe that asked for it.
                        */}
                        {nested.length > 0 ? (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() =>
                                setShowOrigin(showOrigin === originId ? null : originId)
                              }
                              className="text-ink-faint hover:text-ink inline-flex items-center gap-1 text-xs"
                              aria-expanded={showOrigin === originId}
                            >
                              <ChevronDown
                                aria-hidden
                                className={cn(
                                  'size-3 transition-transform',
                                  showOrigin === originId && 'rotate-180',
                                )}
                              />
                              {t('recipe.showOrigin')}
                            </button>
                            {showOrigin === originId ? (
                              <ul className="mt-1 space-y-0.5 pl-4">
                                {entry.sources.map((line, index) => (
                                  <li key={index} className="text-ink-muted text-xs">
                                    {line.provenance
                                      .map((step) => recipeNames[step.recipeId] ?? step.recipeSlug)
                                      .join(' → ')}
                                    {' · '}
                                    <AmountDisplay
                                      amount={line.amount}
                                      className="text-xs"
                                      showUnknownLabel={false}
                                    />
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ) : null}

                        {entry.amount && entry.separate.length > 0 ? (
                          <p className="text-ink-faint mt-1 text-xs">
                            {t('shopping.separateHint')}
                          </p>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>

                {expansion.issues.length > 0 ? (
                  <ul className="border-rule mt-3 space-y-1.5 border-t pt-3">
                    {expansion.issues.map((issue, index) => (
                      <li key={index} className="text-amber flex items-start gap-1.5 text-xs">
                        <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          {issue.code === 'component_yield_unknown'
                            ? t('errors.componentYieldUnknown', {
                                recipe: recipeNames[issue.recipeId] ?? issue.recipeId,
                              })
                            : issue.code === 'component_amount_not_numeric'
                              ? t('errors.componentAmountUnknown', {
                                  recipe: recipeNames[issue.recipeId] ?? issue.recipeId,
                                })
                              : issue.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </CardBody>
        </Card>
      </section>

      {bakers ? (
        <section>
          <SectionHeading>{t('recipe.bakersPercentages')}</SectionHeading>
          <Card>
            <CardBody>
              <dl>
                <DataRow label={t('recipe.hydration')}>
                  {formatPercentValue(bakers.hydrationPct, locale, 2)}%
                </DataRow>
                <DataRow label={t('recipe.salt')}>
                  {formatPercentValue(bakers.saltPct, locale, 2)}%
                </DataRow>
                <DataRow label={t('recipe.yeast')}>
                  {formatPercentValue(bakers.yeastPct, locale, 3)}%
                </DataRow>
                {bakers.oilPct.max.greaterThan(0) ? (
                  <DataRow label={t('recipe.oil')}>
                    {formatPercentValue(bakers.oilPct, locale, 2)}%
                  </DataRow>
                ) : null}
                {bakers.prefermentFlourPct.max.greaterThan(0) ? (
                  <DataRow label={t('recipe.prefermentFlour')}>
                    {formatPercentValue(bakers.prefermentFlourPct, locale, 1)}%
                  </DataRow>
                ) : null}
                {sourcePercentages ? (
                  <DataRow label={t('recipe.sourceBatch')}>
                    <AmountDisplay amount={massAmount(sourcePercentages.totalDough)} />
                  </DataRow>
                ) : null}
                {scaled ? (
                  <DataRow label={t('recipe.targetMass')}>
                    <AmountDisplay
                      amount={{ kind: 'exact', value: scaled.targetTotalG, unit: 'g' }}
                    />
                  </DataRow>
                ) : null}
              </dl>

              {bakers.unknownComponents.length > 0 ? (
                <p className="border-rule text-amber mt-3 flex items-start gap-1.5 border-t pt-3 text-xs">
                  <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  {t('recipe.formulaIncomplete', {
                    names: bakers.unknownComponents
                      .map((id) => ingredientNames[id] ?? id)
                      .join(', '),
                  })}
                </p>
              ) : null}
            </CardBody>
          </Card>
        </section>
      ) : null}
    </div>
  )
}

/** Says what a field will accept, without having silently changed it. */
function FieldHint({ min, max }: { min: number; max: number }) {
  const t = useTranslations()
  return (
    <p role="alert" className="text-tomato mt-1 text-xs">
      {t('errors.outOfRange', { min, max })}
    </p>
  )
}

/**
 * The dough ingredient list.
 *
 * Rendered straight from `scaleDough`, so what is listed, what the percentages
 * say and what the total claims all come from one calculation. The totals row
 * exists because rounding every line for the kitchen moves the sum: showing the
 * drift is honest, and hiding it would let two numbers on the same screen
 * disagree.
 */
function DoughIngredients({
  scaled,
  ingredientNames,
  locale,
}: {
  scaled: ScaledDough
  ingredientNames: Record<string, string>
  locale: string
}) {
  const t = useTranslations()
  const stages: ('preferment' | 'final')[] = scaled.components.some(
    (component) => component.stage === 'preferment',
  )
    ? ['preferment', 'final']
    : ['final']

  const drift = scaled.achievedTotalG.minus(scaled.targetTotalG)
  const agrees = withinTolerance(scaled)

  return (
    <div className="space-y-3">
      {stages.map((stage) => {
        const components = scaled.components.filter((component) => component.stage === stage)
        if (components.length === 0) return null

        return (
          <div key={stage}>
            {stages.length > 1 ? (
              <p className="text-ink-faint mb-1 text-xs font-medium tracking-wide uppercase">
                {stage === 'preferment' ? t('recipe.stagePreferment') : t('recipe.stageFinal')}
              </p>
            ) : null}
            <ul className="divide-rule divide-y">
              {components.map((component, index) => (
                <li
                  key={`${component.ingredientId}-${index}`}
                  className="flex items-baseline justify-between gap-3 py-2.5"
                >
                  <span className="text-ink min-w-0 text-sm">
                    {ingredientNames[component.ingredientId] ?? component.ingredientId}
                  </span>
                  <span className="shrink-0 text-right">
                    <AmountDisplay
                      amount={
                        component.unknown ? { kind: 'unknown' } : massAmount(component.displayMass)
                      }
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      <div className="border-rule border-t pt-2">
        <dl>
          <DataRow label={t('recipe.targetMass')}>
            <AmountDisplay amount={{ kind: 'exact', value: scaled.targetTotalG, unit: 'g' }} />
          </DataRow>
          <DataRow label={t('recipe.achievedMass')}>
            <AmountDisplay amount={massAmount(scaled.achievedTotal)} />
          </DataRow>
        </dl>
        {!scaled.complete ? (
          <p className="text-amber mt-1 flex items-start gap-1.5 text-xs">
            <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {t('recipe.totalApproximate')}
          </p>
        ) : agrees ? (
          <p className="text-ink-faint mt-1 text-xs">
            {t('recipe.totalWithinTolerance', {
              tolerance: formatDecimal(roundingToleranceG(scaled), 'g', locale),
            })}
          </p>
        ) : (
          <p className="text-amber mt-1 flex items-start gap-1.5 text-xs">
            <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {t('recipe.totalDrift', {
              drift: formatDecimal(drift.abs(), 'g', locale),
            })}
          </p>
        )}
      </div>
    </div>
  )
}

export { Button }
