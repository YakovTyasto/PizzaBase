'use client'

import { AlertTriangle, CircleHelp, ExternalLink, Loader2, Plus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState, useTransition } from 'react'
import type { ImportCandidate, IngredientMatchView } from '@/app/actions/import'
import { approveImportAction, matchImportIngredientsAction } from '@/app/actions/import'
import { useRouter } from '@/i18n/navigation'
import { Select } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, Input, SectionHeading } from '@/components/ui/primitives'
import { uploadMediaAction } from '@/app/actions/media'
import { putBlob } from '@/lib/media/idb'
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
  sourcePhoto,
  onDiscard,
}: {
  candidate: ImportCandidate
  /** The photo this candidate came from, when it came from one. */
  sourcePhoto?: { id: string; blob: Blob } | null
  onDiscard: () => void
}) {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { extraction, issues } = candidate

  // Local edits: filling in an unknown is the point of the review.
  const [amounts, setAmounts] = useState<Record<number, string>>({})
  const [matches, setMatches] = useState<IngredientMatchView[] | null>(null)
  const [resolved, setResolved] = useState<Record<string, string>>({})
  const [createNew, setCreateNew] = useState<string[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  /* Off by default: keeping the original photograph is the owner's decision,
     not a side effect of using it to read the recipe. */
  const [keepSourcePhoto, setKeepSourcePhoto] = useState(false)
  const [catalog, setCatalog] = useState<{ slug: string; name: string }[]>([])

  // Ask the server which catalog entries these names correspond to. Matching
  // spans every locale and alias, so the same ingredient in another language
  // resolves to the entry that already exists.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const names = extraction.ingredients.map((ingredient) => ingredient.name)
      const result = await matchImportIngredientsAction(names)
      if (cancelled) return
      setMatches(result)
      setResolved(
        Object.fromEntries(
          result.flatMap((match) => (match.slug ? [[match.extractedName, match.slug]] : [])),
        ),
      )
      setCatalog(
        result.flatMap((match) =>
          match.slug && match.suggestedName
            ? [{ slug: match.slug, name: match.suggestedName }]
            : [],
        ),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [extraction])

  const unmatched = extraction.ingredients.filter(
    (ingredient) => !resolved[ingredient.name] && !createNew.includes(ingredient.name),
  )

  const approve = () => {
    setSaveError(null)
    startTransition(async () => {
      let media: { id: string; storagePath: string | null }[] = []

      if (sourcePhoto && keepSourcePhoto) {
        // Stored the same way any other recipe photo is: locally in demo mode,
        // in the private bucket when one is configured.
        await putBlob(sourcePhoto.id, sourcePhoto.blob)
        const uploaded = await uploadMediaAction({
          id: sourcePhoto.id,
          bytes: await sourcePhoto.blob.arrayBuffer(),
          contentType: sourcePhoto.blob.type || 'image/jpeg',
        })
        if (uploaded.ok) {
          media = [{ id: sourcePhoto.id, storagePath: uploaded.storagePath }]
        } else {
          setSaveError(uploaded.error)
          return
        }
      }

      const result = await approveImportAction({
        extraction,
        sourceUrl: candidate.sourceUrl,
        locale,
        resolved,
        createNew,
        media,
      })
      // Navigate only on a real save; nothing here claims success otherwise.
      if (result.ok) router.push(`/recipes/${result.slug}`)
      else setSaveError(result.error)
    })
  }

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

          {/* Ingredient matching: nothing is created without being asked for. */}
          <Card>
            <CardBody>
              <p className="mb-2 text-xs font-medium tracking-wide text-ink-muted uppercase">
                {t('import.matchIngredient')}
              </p>
              {matches === null ? (
                <p className="text-sm text-ink-muted">{t('common.loading')}</p>
              ) : (
                <ul className="space-y-2">
                  {extraction.ingredients.map((ingredient) => {
                    const slug = resolved[ingredient.name]
                    const creating = createNew.includes(ingredient.name)
                    return (
                      <li
                        key={ingredient.name}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span className="min-w-0 text-sm text-ink">{ingredient.name}</span>
                        <span className="flex items-center gap-2">
                          {slug ? (
                            <Badge tone="good">{t('import.matched')}</Badge>
                          ) : creating ? (
                            <Badge tone="accent">{t('import.createIngredient')}</Badge>
                          ) : (
                            <Badge tone="warn">{t('import.unmatched')}</Badge>
                          )}
                          <Select
                            aria-label={ingredient.name}
                            className="h-9 w-44 text-sm"
                            value={slug ?? (creating ? '__new__' : '')}
                            onChange={(event) => {
                              const value = event.target.value
                              setCreateNew((current) =>
                                current.filter((name) => name !== ingredient.name),
                              )
                              setResolved((current) => {
                                const next = { ...current }
                                delete next[ingredient.name]
                                if (value && value !== '__new__') next[ingredient.name] = value
                                return next
                              })
                              if (value === '__new__') {
                                setCreateNew((current) => [...current, ingredient.name])
                              }
                            }}
                          >
                            <option value="">{t('import.unmatched')}</option>
                            <option value="__new__">{t('import.createIngredient')}</option>
                            {catalog.map((entry) => (
                              <option key={entry.slug} value={entry.slug}>
                                {entry.name}
                              </option>
                            ))}
                          </Select>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
              {unmatched.length > 0 ? (
                <p className="mt-2 text-xs text-amber">
                  {t('import.unmatched')}: {unmatched.map((i) => i.name).join(', ')}
                </p>
              ) : null}
            </CardBody>
          </Card>

          {sourcePhoto ? (
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={keepSourcePhoto}
                onChange={(event) => setKeepSourcePhoto(event.target.checked)}
                className="mt-0.5 size-4 accent-[var(--color-tomato)]"
              />
              <span>
                {t('import.keepPhoto')}
                <span className="block text-xs text-ink-faint">{t('import.keepPhotoHint')}</span>
              </span>
            </label>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={approve}
              disabled={errors.length > 0 || pending || matches === null}
              title={errors.length > 0 ? errors[0]?.message : undefined}
            >
              {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Plus aria-hidden />}
              {t('import.approve')}
            </Button>
            <Button variant="outline" onClick={onDiscard} disabled={pending}>
              {t('import.discard')}
            </Button>
          </div>

          {saveError ? (
            <p role="alert" className="text-sm text-tomato">
              {saveError}
            </p>
          ) : null}

          {errors.length > 0 ? (
            <p className="text-xs text-tomato">{t('import.jobFailed')}</p>
          ) : null}
        </section>
      </div>
    </div>
  )
}
