'use client'

import { Clock, Hourglass, Thermometer } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge, Card, CardBody, EmptyState } from '@/components/ui/primitives'
import type { RecipeItemView, RecipeStepView } from '@/lib/data/types'
import { FallbackBadge } from './badges'

/**
 * Steps distinguish hands-on work from waiting, because "20 minutes" and
 * "24 hours of doing nothing" are not the same commitment.
 */
export function StepList({
  steps,
  items,
}: {
  steps: RecipeStepView[]
  items: RecipeItemView[]
}) {
  const t = useTranslations()

  if (steps.length === 0) {
    return <EmptyState title={t('recipe.noSteps')} hint={t('recipe.noStepsHint')} />
  }

  const itemsById = new Map(items.map((item) => [item.id, item]))

  return (
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const stepItems = step.itemIds.flatMap((id) => {
          const item = itemsById.get(id)
          return item ? [item] : []
        })

        return (
          <li key={step.id}>
            <Card>
              <CardBody>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-paper-sunken text-xs font-semibold text-ink-muted">
                    {index + 1}
                  </span>
                  <Badge tone="outline">{t(`phase.${step.phase}`)}</Badge>

                  {step.activeMinutes > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
                      <Clock aria-hidden className="size-3.5" />
                      {t('common.minutes', { count: step.activeMinutes })}
                    </span>
                  ) : null}

                  {step.waitMaxMinutes > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
                      <Hourglass aria-hidden className="size-3.5" />
                      {step.waitMinMinutes === step.waitMaxMinutes
                        ? formatWait(step.waitMaxMinutes, t)
                        : `${formatWait(step.waitMinMinutes, t)} – ${formatWait(step.waitMaxMinutes, t)}`}
                    </span>
                  ) : null}

                  {step.temperatureC !== null ? (
                    <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
                      <Thermometer aria-hidden className="size-3.5" />
                      {step.temperatureC}°C
                    </span>
                  ) : null}

                  {!step.durationKnown ? (
                    <Badge tone="warn" title={t('planner.approximateHint')}>
                      {t('planner.approximate')}
                    </Badge>
                  ) : null}
                </div>

                <p className="text-ink">
                  {step.instruction.value}
                  <FallbackBadge text={step.instruction} />
                </p>

                {stepItems.length > 0 ? (
                  <p className="mt-2 text-xs text-ink-faint">
                    {t('cooking.ingredientsForStep')}:{' '}
                    {stepItems.map((item) => item.name.value).join(', ')}
                  </p>
                ) : null}

                {step.cues ? (
                  <p className="mt-2 rounded-lg bg-basil-soft px-3 py-2 text-sm text-basil">
                    {step.cues.value}
                  </p>
                ) : null}

                {step.troubleshooting ? (
                  <p className="mt-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">
                    {step.troubleshooting.value}
                  </p>
                ) : null}
              </CardBody>
            </Card>
          </li>
        )
      })}
    </ol>
  )
}

function formatWait(minutes: number, t: ReturnType<typeof useTranslations>): string {
  return minutes >= 60
    ? t('common.hours', { count: Math.round(minutes / 60) })
    : t('common.minutes', { count: minutes })
}
