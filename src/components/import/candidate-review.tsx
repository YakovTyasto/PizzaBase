'use client'

import { AlertTriangle, CircleHelp, ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { ImportCandidate } from '@/app/actions/import'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, Input, SectionHeading } from '@/components/ui/primitives'
import { formatTimecode } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Review before save.
 *
 * Nothing here has been persisted. Unknowns and conflicts are visually loud
 * because they are the whole reason this screen exists: the user is being asked
 * to supply what the source did not say, not to rubber-stamp a guess.
 */
export function CandidateReview({
  candidate,
  onDiscard,
}: {
  candidate: ImportCandidate
  onDiscard: () => void
}) {
  const t = useTranslations()
  const { extraction, issues } = candidate

  // Local edits: filling in an unknown is the point of the review.
  const [amounts, setAmounts] = useState<Record<number, string>>({})

  const unknownCount = extraction.ingredients.filter((i) => i.amount.kind === 'unknown').length
  const conflictCount = extraction.conflicts.length
  const errors = issues.filter((issue) => issue.severity === 'error')

  const timeLink = (seconds: number | null) => {
    if (seconds === null || !candidate.videoId) return null
    return (
      <a
        href={`https://www.youtube.com/watch?v=${candidate.videoId}&t=${seconds}s`}
        target="_blank"
        rel="noreferrer noopener"
        className="ml-2 inline-flex items-center gap-1 text-xs text-tomato underline underline-offset-2"
      >
        <ExternalLink aria-hidden className="size-3" />
        {formatTimecode(seconds)}
      </a>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">{t('import.review')}</h2>
          <p className="text-sm text-ink-muted">{t('import.reviewHint')}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {unknownCount > 0 ? (
            <Badge tone="warn">{t('import.unknowns', { count: unknownCount })}</Badge>
          ) : null}
          {conflictCount > 0 ? (
            <Badge tone="accent">{t('import.conflicts', { count: conflictCount })}</Badge>
          ) : null}
        </div>
      </div>

      {/* Source on one side, candidate on the other. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section>
          <SectionHeading>{t('import.sourcePanel')}</SectionHeading>
          <Card>
            <CardBody className="space-y-2">
              {candidate.videoId ? (
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-paper-sunken">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${candidate.videoId}`}
                    title={extraction.title ?? t('import.sourcePanel')}
                    allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                    allowFullScreen
                    className="size-full border-0"
                  />
                </div>
              ) : null}
              {candidate.sourceUrl ? (
                <a
                  href={candidate.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-sm text-tomato underline underline-offset-2"
                >
                  <ExternalLink aria-hidden className="size-3.5" />
                  {t('recipe.openSource')}
                </a>
              ) : null}
              <p className="text-xs text-ink-faint">{t('import.privacyNote')}</p>
            </CardBody>
          </Card>
        </section>

        <section className="space-y-4">
          <SectionHeading>{t('import.candidatePanel')}</SectionHeading>

          <Card>
            <CardBody className="space-y-3">
              <div>
                <p className="font-display text-lg font-semibold text-ink">
                  {extraction.title ?? t('common.unknown')}
                </p>
                {extraction.summary ? (
                  <p className="mt-1 text-sm text-ink-muted">{extraction.summary}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Badge tone="neutral">{t(`recipeType.${extraction.type}`)}</Badge>
                <Badge tone="outline">
                  {t('evidence.confidence')} {Math.round(extraction.overallConfidence * 100)}%
                </Badge>
                {extraction.yieldCount ? (
                  <Badge tone="outline">
                    {t('recipe.yield')}: {extraction.yieldCount}
                  </Badge>
                ) : (
                  <Badge tone="warn">{t('recipe.yieldUnknown')}</Badge>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="mb-2 text-xs font-medium tracking-wide text-ink-muted uppercase">
                {t('recipe.ingredients')}
              </p>
              <ul className="divide-y divide-rule">
                {extraction.ingredients.map((ingredient, index) => {
                  const unknown = ingredient.amount.kind === 'unknown'
                  const range = ingredient.amount.kind === 'range'

                  return (
                    <li
                      key={`${ingredient.name}-${index}`}
                      className={cn(
                        'py-2.5',
                        unknown && 'bg-amber-soft/40',
                        range && 'bg-tomato-soft/30',
                      )}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm text-ink">
                          {ingredient.name}
                          {ingredient.optional ? (
                            <span className="ml-1.5 text-xs text-ink-faint">
                              ({t('common.optional')})
                            </span>
                          ) : null}
                          {timeLink(ingredient.startSeconds)}
                        </span>

                        <span className="tabular text-sm">
                          {ingredient.amount.kind === 'exact' ? (
                            <span className="font-medium text-ink">
                              {ingredient.amount.value} {ingredient.amount.unit}
                            </span>
                          ) : ingredient.amount.kind === 'range' ? (
                            <span className="font-medium text-tomato-strong">
                              {ingredient.amount.min}–{ingredient.amount.max}{' '}
                              {ingredient.amount.unit}
                            </span>
                          ) : ingredient.amount.kind === 'qualitative' ? (
                            <span className="text-ink-muted italic">
                              {t(`units.${ingredient.amount.unit}`, { count: 1 })}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber">
                              <CircleHelp aria-hidden className="size-3.5" />
                              {t('amount.unknown')}
                            </span>
                          )}
                        </span>
                      </div>

                      {unknown ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          <Input
                            aria-label={`${ingredient.name} — ${t('pantry.quantity')}`}
                            placeholder={t('pantry.quantity')}
                            className="h-9 max-w-40 text-sm"
                            value={amounts[index] ?? ''}
                            onChange={(event) =>
                              setAmounts((current) => ({
                                ...current,
                                [index]: event.target.value,
                              }))
                            }
                          />
                          <span className="text-xs text-ink-faint">
                            {'reason' in ingredient.amount ? ingredient.amount.reason : ''}
                          </span>
                        </div>
                      ) : null}

                      {ingredient.note ? (
                        <p className="mt-1 text-xs text-ink-faint">{ingredient.note}</p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </CardBody>
          </Card>

          {extraction.steps.length > 0 ? (
            <Card>
              <CardBody>
                <p className="mb-2 text-xs font-medium tracking-wide text-ink-muted uppercase">
                  {t('recipe.steps')}
                </p>
                <ol className="space-y-2">
                  {extraction.steps.map((step, index) => (
                    <li key={index} className="text-sm">
                      <span className="mr-2 text-ink-faint">{index + 1}.</span>
                      <span className="text-ink">{step.instruction}</span>
                      {timeLink(step.startSeconds)}
                      {step.sensoryCues ? (
                        <p className="mt-0.5 pl-5 text-xs text-basil">{step.sensoryCues}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          ) : null}

          {issues.length > 0 ? (
            <Card className={errors.length > 0 ? 'border-tomato' : undefined}>
              <CardBody>
                <p className="mb-2 text-xs font-medium tracking-wide text-ink-muted uppercase">
                  {t('evidence.title')}
                </p>
                <ul className="space-y-1.5">
                  {issues.map((issue, index) => (
                    <li
                      key={index}
                      className={cn(
                        'flex items-start gap-1.5 text-sm',
                        issue.severity === 'error' ? 'text-tomato-strong' : 'text-amber',
                      )}
                    >
                      <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        <span className="font-medium">{issue.field}</span> — {issue.message}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={errors.length > 0}
              title={errors.length > 0 ? errors[0]?.message : undefined}
            >
              {t('import.approve')}
            </Button>
            <Button variant="outline" onClick={onDiscard}>
              {t('import.discard')}
            </Button>
          </div>

          {errors.length > 0 ? (
            <p className="text-xs text-tomato">{t('import.jobFailed')}</p>
          ) : null}
        </section>
      </div>
    </div>
  )
}
