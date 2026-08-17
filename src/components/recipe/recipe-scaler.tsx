'use client'

import { Decimal } from 'decimal.js'
import { AlertTriangle, ChevronDown, Info } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import {
  type ToppingScaleMode,
  RecipeCycleError,
  aggregateLines,
  computeBakersPercentages,
  doughFactor,
  expandRecipe,
  toppingFactor,
} from '@/domain'
import { AmountDisplay } from '@/components/recipe/amount-display'
import { Button } from '@/components/ui/button'
import { Card, CardBody, DataRow, Input, Label, SectionHeading } from '@/components/ui/primitives'
import type { RecipeDetail } from '@/lib/data/types'
import { type WireGraph, deserializeGraph } from '@/lib/data/serialize'
import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import { doughFormulaFor } from './dough-formula'

/**
 * Live scaling.
 *
 * Everything here calls the same pure functions the server and the tests use.
 * There is no second implementation of the arithmetic in the UI, which is what
 * guarantees the number on screen matches the number on the shopping list.
 */
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
  const basePizzas = Number(recipe.baseYield ?? 1) || 1

  const [count, setCount] = useState(basePizzas)
  const [diameter, setDiameter] = useState(recipe.baseDiameterMm ?? 300)
  const [ballWeight, setBallWeight] = useState(Number(recipe.baseBallWeightG ?? 250))
  const [mode, setMode] = useState<ToppingScaleMode>('area')
  const [showOrigin, setShowOrigin] = useState<string | null>(null)

  const graph = useMemo(() => deserializeGraph(wireGraph), [wireGraph])

  const factor = useMemo(() => {
    try {
      if (isDough) {
        const domainRecipe = graph.recipe(recipe.id)
        if (!domainRecipe) return new Decimal(1)
        return doughFactor({
          baseRecipe: domainRecipe,
          basePizzaCount: basePizzas,
          targetBallCount: count,
          targetBallWeightG: ballWeight,
        })
      }
      const baseSize =
        recipe.baseShape === 'round' && recipe.baseDiameterMm
          ? ({ shape: 'round', diameterMm: recipe.baseDiameterMm } as const)
          : null
      return toppingFactor({
        mode,
        basePizzaCount: basePizzas,
        targetPizzaCount: count,
        baseSize,
        targetSize: baseSize ? { shape: 'round', diameterMm: diameter } : null,
      })
    } catch {
      return new Decimal(1)
    }
  }, [
    isDough,
    graph,
    recipe.id,
    recipe.baseShape,
    recipe.baseDiameterMm,
    basePizzas,
    count,
    ballWeight,
    mode,
    diameter,
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

  const aggregated = useMemo(
    () => aggregateLines(graph, expansion.lines),
    [graph, expansion.lines],
  )

  const dough = useMemo(() => {
    if (!isDough) return null
    const formula = doughFormulaFor(recipe)
    if (!formula) return null
    try {
      const percentages = computeBakersPercentages(formula)
      return percentages
    } catch {
      return null
    }
  }, [isDough, recipe])

  const cyclePath = 'cycle' in expansion ? (expansion.cycle as string[]) : null

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
              <Input
                id="scale-count"
                type="number"
                min={1}
                max={99}
                inputMode="numeric"
                value={count}
                onChange={(event) => setCount(Math.max(1, Number(event.target.value) || 1))}
              />
            </div>

            {isDough ? (
              <div>
                <Label htmlFor="scale-ball">{t('recipe.ballWeight')}</Label>
                <Input
                  id="scale-ball"
                  type="number"
                  min={50}
                  max={2000}
                  step={5}
                  inputMode="numeric"
                  value={ballWeight}
                  onChange={(event) =>
                    setBallWeight(Math.max(50, Number(event.target.value) || 250))
                  }
                />
              </div>
            ) : recipe.baseShape === 'round' ? (
              <div>
                <Label htmlFor="scale-diameter">{t('recipe.diameter')} (mm)</Label>
                <Input
                  id="scale-diameter"
                  type="number"
                  min={100}
                  max={600}
                  step={10}
                  inputMode="numeric"
                  value={diameter}
                  onChange={(event) => setDiameter(Math.max(100, Number(event.target.value) || 300))}
                />
              </div>
            ) : null}

            {!isDough ? (
              <div>
                <Label htmlFor="scale-mode">{t('recipe.scale')}</Label>
                <div className="flex h-11 items-center gap-1 rounded-lg border border-rule p-1">
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
            <p className="flex items-start gap-1.5 text-xs text-ink-faint">
              <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {t('recipe.scaleByAreaHint')}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {cyclePath ? (
        <Card className="border-tomato">
          <CardBody className="flex items-start gap-2 text-sm text-tomato-strong">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">{t('errors.cycle')}</p>
              <p className="mt-0.5 text-ink-muted">
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
            {aggregated.length === 0 && expansion.issues.length === 0 ? (
              <p className="py-2 text-sm text-ink-muted">{t('recipes.empty')}</p>
            ) : null}

            <ul className="divide-y divide-rule">
              {aggregated.map((entry) => {
                const name = ingredientNames[entry.ingredientId] ?? entry.ingredientId
                const originId = entry.ingredientId
                const nested = entry.sources.filter((line) => line.provenance.length > 1)

                return (
                  <li key={entry.ingredientId} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 text-sm text-ink">
                        {name}
                        {entry.optional ? (
                          <span className="ml-1.5 text-xs text-ink-faint">
                            ({t('common.optional')})
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-right">
                        {entry.amount ? (
                          <AmountDisplay amount={entry.amount} />
                        ) : (
                          entry.separate.slice(0, 1).map((line, index) => (
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
                          onClick={() => setShowOrigin(showOrigin === originId ? null : originId)}
                          className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink"
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
                              <li key={index} className="text-xs text-ink-muted">
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
                      <p className="mt-1 text-xs text-ink-faint">
                        {t('shopping.separateHint')}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>

            {expansion.issues.length > 0 ? (
              <ul className="mt-3 space-y-1.5 border-t border-rule pt-3">
                {expansion.issues.map((issue, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-1.5 text-xs text-amber"
                  >
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
          </CardBody>
        </Card>
      </section>

      {dough ? (
        <section>
          <SectionHeading>{t('recipe.bakersPercentages')}</SectionHeading>
          <Card>
            <CardBody>
              <dl>
                <DataRow label={t('recipe.hydration')}>
                  {formatPercent(dough.hydrationPct, locale, 2)}%
                </DataRow>
                <DataRow label={t('recipe.salt')}>
                  {formatPercent(dough.saltPct, locale, 2)}%
                </DataRow>
                <DataRow label={t('recipe.yeast')}>
                  {formatPercent(dough.yeastPct, locale, 3)}%
                </DataRow>
                {dough.oilPct.greaterThan(0) ? (
                  <DataRow label={t('recipe.oil')}>
                    {formatPercent(dough.oilPct, locale, 2)}%
                  </DataRow>
                ) : null}
                {dough.prefermentFlourPct.greaterThan(0) ? (
                  <DataRow label={t('recipe.prefermentFlour')}>
                    {formatPercent(dough.prefermentFlourPct, locale, 1)}%
                  </DataRow>
                ) : null}
                <DataRow label={t('recipe.targetMass')}>
                  <AmountDisplay
                    amount={{
                      kind: 'exact',
                      value: new Decimal(count).times(ballWeight),
                      unit: 'g',
                    }}
                  />
                </DataRow>
              </dl>
            </CardBody>
          </Card>
        </section>
      ) : null}
    </div>
  )
}

export { Button }
