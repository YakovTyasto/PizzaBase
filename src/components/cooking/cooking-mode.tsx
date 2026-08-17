'use client'

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Hourglass,
  Pause,
  Play,
  Plus,
  Sun,
  Thermometer,
  Timer as TimerIcon,
  Trash2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, Input } from '@/components/ui/primitives'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import {
  type CookProgress,
  type CookTimer,
  clearProgress,
  formatRemaining,
  loadProgress,
  remainingMs,
  saveProgress,
  useNow,
  useTimers,
} from './timers'
import { useWakeLock } from './use-wake-lock'

export interface CookStep {
  id: string
  phase: string
  instruction: string
  cues: string | null
  troubleshooting: string | null
  activeMinutes: number
  waitMinMinutes: number
  waitMaxMinutes: number
  temperatureC: number | null
  itemNames: string[]
}

/**
 * One step at a time, sized for a phone propped against a flour bag.
 *
 * Progress and timers live in local storage, so closing the tab, reloading or
 * losing the network mid-bake does not lose the session. Everything here works
 * offline by design.
 */
export function CookingMode({
  recipeId,
  recipeName,
  steps,
}: {
  recipeId: string
  recipeName: string
  steps: CookStep[]
}) {
  const t = useTranslations()
  const wakeLock = useWakeLock()

  const [progress, setProgress] = useState<CookProgress | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Restore on mount rather than during render: local storage is not available
  // on the server and reading it during render would break hydration.
  useEffect(() => {
    const restored = loadProgress(recipeId)
    setProgress(
      restored ?? {
        recipeId,
        startedAt: new Date().toISOString(),
        currentStep: 0,
        completedStepIds: [],
        timers: [],
      },
    )
    setHydrated(true)
  }, [recipeId])

  const persist = useCallback((next: CookProgress) => {
    setProgress(next)
    saveProgress(next)
  }, [])

  const onTimersChange = useCallback(
    (timers: CookTimer[]) => {
      setProgress((current) => {
        if (!current) return current
        const next = { ...current, timers }
        saveProgress(next)
        return next
      })
    },
    [],
  )

  const { timers, add, pause, resume, remove } = useTimers(progress?.timers ?? [], onTimersChange)
  const now = useNow(timers.length > 0)

  const currentIndex = progress?.currentStep ?? 0
  const step = steps[Math.min(currentIndex, steps.length - 1)]
  const completed = useMemo(
    () => new Set(progress?.completedStepIds ?? []),
    [progress?.completedStepIds],
  )

  const [timerMinutes, setTimerMinutes] = useState('')

  if (!hydrated || !progress || !step) {
    return <p className="text-sm text-ink-muted">{t('common.loading')}</p>
  }

  const goTo = (index: number) => {
    persist({ ...progress, currentStep: Math.max(0, Math.min(steps.length - 1, index)) })
  }

  const toggleComplete = () => {
    const next = new Set(completed)
    if (next.has(step.id)) next.delete(step.id)
    else next.add(step.id)
    persist({ ...progress, completedStepIds: [...next] })
  }

  const finish = () => {
    clearProgress(recipeId)
    persist({ ...progress, completedStepIds: steps.map((s) => s.id) })
  }

  const isDone = completed.size === steps.length
  const suggestedMinutes = step.waitMaxMinutes || step.activeMinutes || 10

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/recipes/${recipeId}`}
            className="text-xs text-ink-faint underline-offset-2 hover:underline"
          >
            {recipeName}
          </Link>
          <p className="tabular text-sm text-ink-muted">
            {t('cooking.step', { current: currentIndex + 1, total: steps.length })}
          </p>
        </div>

        <Button
          variant={wakeLock.enabled ? 'primary' : 'outline'}
          size="sm"
          onClick={() => wakeLock.setEnabled(!wakeLock.enabled)}
          title={wakeLock.supported ? undefined : t('cooking.keepAwakeUnsupported')}
          disabled={!wakeLock.supported}
        >
          <Sun aria-hidden />
          {t('cooking.keepAwake')}
        </Button>
      </div>

      {!wakeLock.supported ? (
        <p className="text-xs text-ink-faint">{t('cooking.keepAwakeUnsupported')}</p>
      ) : null}

      {/* Progress bar */}
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-paper-sunken"
        role="progressbar"
        aria-valuenow={completed.size}
        aria-valuemin={0}
        aria-valuemax={steps.length}
      >
        <div
          className="h-full bg-basil transition-[width]"
          style={{ width: `${(completed.size / steps.length) * 100}%` }}
        />
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="outline">{t(`phase.${step.phase}`)}</Badge>
            {step.activeMinutes > 0 ? (
              <Badge tone="accent">
                {t('cooking.activeWork')} · {t('common.minutes', { count: step.activeMinutes })}
              </Badge>
            ) : null}
            {step.waitMaxMinutes > 0 ? (
              <Badge tone="neutral">
                <Hourglass aria-hidden className="size-3" />
                {t('cooking.waiting')}
              </Badge>
            ) : null}
            {step.temperatureC !== null ? (
              <Badge tone="neutral">
                <Thermometer aria-hidden className="size-3" />
                {step.temperatureC}°C
              </Badge>
            ) : null}
          </div>

          <p className="font-display text-xl leading-relaxed text-ink sm:text-2xl">
            {step.instruction}
          </p>

          {step.itemNames.length > 0 ? (
            <div className="rounded-lg bg-paper-sunken px-3 py-2">
              <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                {t('cooking.ingredientsForStep')}
              </p>
              <p className="mt-0.5 text-sm text-ink">{step.itemNames.join(' · ')}</p>
            </div>
          ) : null}

          {step.cues ? (
            <div className="rounded-lg bg-basil-soft px-3 py-2">
              <p className="text-xs font-medium tracking-wide text-basil uppercase">
                {t('cooking.cues')}
              </p>
              <p className="mt-0.5 text-sm text-basil">{step.cues}</p>
            </div>
          ) : null}

          {step.troubleshooting ? (
            <div className="rounded-lg bg-amber-soft px-3 py-2">
              <p className="text-xs font-medium tracking-wide text-amber uppercase">
                {t('cooking.troubleshooting')}
              </p>
              <p className="mt-0.5 text-sm text-amber">{step.troubleshooting}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-3">
            <Button
              variant={completed.has(step.id) ? 'primary' : 'outline'}
              onClick={toggleComplete}
            >
              <Check aria-hidden />
              {t('cooking.done')}
            </Button>

            <Button
              variant="outline"
              onClick={() => add(step.instruction.slice(0, 40), suggestedMinutes)}
            >
              <TimerIcon aria-hidden />
              {t('cooking.startTimer')} ({suggestedMinutes}′)
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Several timers can run at once: dough resting while the oven heats. */}
      <section>
        <div className="mb-2 flex items-end gap-2">
          <div className="w-28">
            <label htmlFor="custom-timer" className="mb-1 block text-xs text-ink-muted">
              {t('cooking.addTimer')}
            </label>
            <Input
              id="custom-timer"
              type="number"
              min={1}
              max={2880}
              inputMode="numeric"
              placeholder="15"
              value={timerMinutes}
              onChange={(event) => setTimerMinutes(event.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              const minutes = Number(timerMinutes)
              if (minutes > 0) {
                add(t('cooking.timer'), minutes)
                setTimerMinutes('')
              }
            }}
            disabled={!timerMinutes || Number(timerMinutes) <= 0}
          >
            <Plus aria-hidden />
          </Button>
        </div>

        {timers.length > 0 ? (
          <ul className="space-y-2">
            {timers.map((timer) => {
              const left = remainingMs(timer, now)
              const done = left <= 0
              return (
                <li key={timer.id}>
                  <Card className={done ? 'border-tomato' : undefined}>
                    <CardBody className="flex items-center gap-3 py-3">
                      <span
                        className={cn(
                          'tabular text-2xl font-semibold',
                          done ? 'text-tomato' : 'text-ink',
                        )}
                      >
                        {formatRemaining(left)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                        {done ? t('cooking.timerDone') : timer.label}
                      </span>
                      {!done ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={
                            timer.remainingMs === null
                              ? t('cooking.pauseTimer')
                              : t('cooking.startTimer')
                          }
                          onClick={() =>
                            timer.remainingMs === null ? pause(timer.id) : resume(timer.id)
                          }
                        >
                          {timer.remainingMs === null ? (
                            <Pause aria-hidden />
                          ) : (
                            <Play aria-hidden />
                          )}
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('common.delete')}
                        onClick={() => remove(timer.id)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </CardBody>
                  </Card>
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>

      {/* Sticky pager so the hands-free controls stay reachable. */}
      <div className="sticky bottom-20 z-20 flex gap-2 lg:bottom-4">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex === 0}
        >
          <ChevronLeft aria-hidden />
          {t('common.previous')}
        </Button>
        {currentIndex === steps.length - 1 ? (
          <Button className="flex-1" onClick={finish}>
            <Check aria-hidden />
            {t('cooking.finish')}
          </Button>
        ) : (
          <Button className="flex-1" onClick={() => goTo(currentIndex + 1)}>
            {t('common.next')}
            <ChevronRight aria-hidden />
          </Button>
        )}
      </div>

      {isDone ? (
        <Card className="border-basil">
          <CardBody>
            <p className="font-medium text-basil">{t('cooking.complete')}</p>
            <p className="mt-1 text-sm text-ink-muted">{t('cooking.offlineNote')}</p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
