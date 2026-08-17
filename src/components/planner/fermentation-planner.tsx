'use client'

import { AlertTriangle, CalendarCheck, Download } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import {
  type PlannableStep,
  type SchedulePreference,
  type StepPhase,
  planBackwards,
  planToIcs,
  totalWindowMinutes,
} from '@/domain'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, Input, Label } from '@/components/ui/primitives'
import { appConfig } from '@/lib/config/app-config'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

interface PlannerStep extends PlannableStep {
  instruction: string
  cues: string | null
}

/** Default serve time: 19:00 tomorrow, which is what a pizza night usually is. */
function defaultServeAt(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(19, 0, 0, 0)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function FermentationPlanner({
  recipeName,
  steps,
}: {
  recipeName: string
  steps: PlannerStep[]
}) {
  const t = useTranslations()
  const locale = useLocale()

  const [serveAt, setServeAt] = useState(defaultServeAt)
  const [preference, setPreference] = useState<SchedulePreference>('target')

  const plan = useMemo(() => {
    const date = new Date(serveAt)
    if (Number.isNaN(date.getTime())) return null
    return planBackwards(steps, date, preference)
  }, [steps, serveAt, preference])

  const window = useMemo(() => totalWindowMinutes(steps), [steps])
  const stepsById = useMemo(() => new Map(steps.map((step) => [step.id, step])), [steps])

  const downloadIcs = () => {
    if (!plan) return
    const titles = Object.fromEntries(
      steps.map((step) => [step.id, `${recipeName}: ${step.instruction.slice(0, 60)}`]),
    )
    const ics = planToIcs(plan, titles, `${appConfig.name} · ${recipeName}`)
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${recipeName.replace(/[^\w-]+/g, '-').toLowerCase()}.ics`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const formatDuration = (minutes: number) =>
    minutes >= 60
      ? t('common.hours', { count: Math.round(minutes / 60) })
      : t('common.minutes', { count: minutes })

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="serve-at">{t('planner.serveTime')}</Label>
              <Input
                id="serve-at"
                type="datetime-local"
                value={serveAt}
                onChange={(event) => setServeAt(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="window">{t('planner.window')}</Label>
              <div
                id="window"
                className="flex h-11 items-center gap-1 rounded-lg border border-rule p-1"
              >
                {(['short', 'target', 'long'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPreference(option)}
                    className={cn(
                      'h-full flex-1 rounded-md px-2 text-xs font-medium transition-colors',
                      preference === option
                        ? 'bg-ink text-paper'
                        : 'text-ink-muted hover:bg-paper-sunken',
                    )}
                  >
                    {t(`planner.${option}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-ink-faint">
            {t('planner.totalTime', {
              duration:
                window.min === window.max
                  ? formatDuration(window.min)
                  : `${formatDuration(window.min)} – ${formatDuration(window.max)}`,
            })}
          </p>
        </CardBody>
      </Card>

      {plan ? (
        <>
          <Card className="border-tomato">
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs tracking-wide text-ink-muted uppercase">
                  {t('planner.startAt')}
                </p>
                <p className="font-display text-xl font-semibold text-ink">
                  {formatDateTime(plan.startAt, locale)}
                </p>
              </div>
              <Button variant="outline" onClick={downloadIcs}>
                <Download aria-hidden />
                {t('planner.exportIcs')}
              </Button>
            </CardBody>
          </Card>

          {/*
            An approximate-timing warning is shown whenever any step's duration
            was never stated. The app schedules what the recipe says and does
            not model fermentation from temperature on its own.
          */}
          {plan.hasApproximateTiming ? (
            <p className="flex items-start gap-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong className="font-medium">{t('planner.approximate')}.</strong>{' '}
                {t('planner.approximateHint')}
              </span>
            </p>
          ) : null}

          <ol className="space-y-2">
            {plan.steps.map((scheduled) => {
              const step = stepsById.get(scheduled.stepId)
              return (
                <li key={scheduled.stepId}>
                  <Card>
                    <CardBody className="py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="tabular font-display text-lg font-semibold text-ink">
                          {formatDateTime(scheduled.startAt, locale)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Badge tone="outline">{t(`phase.${scheduled.phase as StepPhase}`)}</Badge>
                          {!scheduled.durationKnown ? (
                            <Badge tone="warn">{t('planner.approximate')}</Badge>
                          ) : null}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-ink">{step?.instruction}</p>
                      {scheduled.waitMinutes > 0 ? (
                        <p className="mt-0.5 text-xs text-ink-faint">
                          {t('cooking.waiting')}: {formatDuration(scheduled.waitMinutes)}
                        </p>
                      ) : null}
                      {step?.cues ? (
                        <p className="mt-1 text-xs text-basil">{step.cues}</p>
                      ) : null}
                    </CardBody>
                  </Card>
                </li>
              )
            })}
          </ol>

          <Card>
            <CardBody className="flex items-center justify-between gap-3 py-3">
              <span className="flex items-center gap-2 text-sm text-ink-muted">
                <CalendarCheck aria-hidden className="size-4" />
                {t('planner.serveTime')}
              </span>
              <span className="tabular font-medium text-ink">
                {formatDateTime(plan.serveAt, locale)}
              </span>
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  )
}
