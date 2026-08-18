'use client'

import { CheckCircle2, HelpCircle, ShoppingBasket } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { AmountDisplay } from '@/components/recipe/amount-display'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, EmptyState } from '@/components/ui/primitives'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { type WireAmount, deserializeAmount } from '@/lib/data/serialize'

export interface RecommendationWire {
  recipeId: string
  slug: string
  name: string
  styleName: string | null
  authenticity: string | null
  canCookNow: boolean
  /** False when a mandatory quantity is missing, so coverage is indeterminate. */
  dataComplete: boolean
  /** Ingredients the recipe needs without saying how much of. */
  unknownRequired: { ingredientId: string; name: string }[]
  /** Uncheckable but harmless: optional unknowns and "to taste" lines. */
  unknownOptional: { ingredientId: string; name: string }[]
  coverage: number
  reasons: { kind: string; value: string | null; minutes: number | null }[]
  missing: {
    ingredientId: string
    name: string
    short: WireAmount | null
    optional: boolean
    substitutions: { name: string; grade: string; explanation: string }[]
  }[]
}

export function RecommendationList({
  results,
  includeExperimental,
}: {
  results: RecommendationWire[]
  includeExperimental: boolean
}) {
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const toggleExperimental = (next: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set('experimental', '1')
    else params.delete('experimental')
    startTransition(() => router.replace(`${pathname}?${params.toString()}`))
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeExperimental}
          disabled={pending}
          onChange={(event) => toggleExperimental(event.target.checked)}
          className="mt-0.5 size-4 accent-[var(--color-tomato)]"
        />
        <span>
          <span className="text-ink">{t('recommendations.includeExperimental')}</span>
          <span className="text-ink-faint block text-xs">
            {t('recommendations.includeExperimentalHint')}
          </span>
        </span>
      </label>

      {results.length === 0 ? (
        <EmptyState title={t('recommendations.empty')} hint={t('recommendations.emptyHint')} />
      ) : (
        <ul className="space-y-4">
          {results.map((result) => (
            <li key={result.recipeId}>
              <Card className={result.canCookNow ? 'border-basil' : undefined}>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/recipes/${result.slug}`}
                        className="font-display text-ink text-lg font-semibold underline-offset-4 hover:underline"
                      >
                        {result.name}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {result.styleName ? (
                          <span className="text-ink-faint text-xs">{result.styleName}</span>
                        ) : null}
                        {result.authenticity ? (
                          <Badge tone="outline">{t(`authenticity.${result.authenticity}`)}</Badge>
                        ) : null}
                      </p>
                    </div>
                    {/*
                      Three distinct answers, never collapsed into two: you can
                      cook this now, you are short some products, or the recipe
                      does not say enough for the question to be answered. The
                      third used to be reported as the first.
                    */}
                    {result.canCookNow ? (
                      <Badge tone="good">
                        <CheckCircle2 aria-hidden className="size-3" />
                        {t('recommendations.canCookNow')}
                      </Badge>
                    ) : !result.dataComplete ? (
                      <Badge tone="neutral">
                        <HelpCircle aria-hidden className="size-3" />
                        {t('recommendations.dataIncomplete')}
                      </Badge>
                    ) : (
                      <Badge tone="warn">
                        {t('recommendations.missingCount', {
                          count: result.missing.filter((m) => !m.optional).length,
                        })}
                      </Badge>
                    )}
                  </div>

                  {/* Why this recipe: reasons come from the ranking, not prose. */}
                  <ul className="flex flex-wrap gap-1.5">
                    <li>
                      <Badge tone="neutral">
                        {result.dataComplete
                          ? t('recommendations.reasonCoverage', { percent: result.coverage })
                          : t('recommendations.coverageUnknown')}
                      </Badge>
                    </li>
                    {result.reasons
                      .filter((reason) => reason.kind === 'oven_match')
                      .map((reason, index) => (
                        <li key={`oven-${index}`}>
                          <Badge tone="neutral">{t('recommendations.reasonOvenMatch')}</Badge>
                        </li>
                      ))}
                    {result.reasons
                      .filter((reason) => reason.kind === 'missing_only_optional')
                      .map((reason, index) => (
                        <li key={`opt-${index}`}>
                          <Badge tone="good">
                            {t('recommendations.reasonMissingOnlyOptional')}
                          </Badge>
                        </li>
                      ))}
                  </ul>

                  {result.unknownRequired.length > 0 ? (
                    <div className="border-rule border-t pt-3">
                      <p className="text-ink-muted mb-1.5 text-xs font-medium tracking-wide uppercase">
                        {t('recommendations.dataIncomplete')}
                      </p>
                      <p className="text-ink-muted text-sm">
                        {t('recommendations.dataIncompleteHint', {
                          names: result.unknownRequired.map((entry) => entry.name).join(', '),
                        })}
                      </p>
                      <div className="mt-2">
                        <Link href={`/recipes/${result.slug}/edit`}>
                          <Button variant="outline" size="sm">
                            {t('recommendations.completeRecipe')}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ) : null}

                  {result.unknownOptional.length > 0 ? (
                    <p className="text-ink-faint text-xs">
                      {t('recommendations.unknownOptional', {
                        names: result.unknownOptional.map((entry) => entry.name).join(', '),
                      })}
                    </p>
                  ) : null}

                  {result.missing.length > 0 ? (
                    <div className="border-rule border-t pt-3">
                      <p className="text-ink-muted mb-1.5 text-xs font-medium tracking-wide uppercase">
                        {t('recommendations.missing')}
                      </p>
                      <ul className="space-y-2">
                        {result.missing.map((missing) => (
                          <li key={missing.ingredientId} className="text-sm">
                            <span className="text-ink">{missing.name}</span>
                            {missing.short ? (
                              <span className="text-ink-muted ml-2">
                                <AmountDisplay
                                  amount={deserializeAmount(missing.short)}
                                  className="text-xs"
                                />
                              </span>
                            ) : null}

                            {missing.substitutions.length > 0 ? (
                              <ul className="mt-1 space-y-0.5 pl-3">
                                {missing.substitutions.map((substitution) => (
                                  <li key={substitution.name} className="text-ink-muted text-xs">
                                    → {substitution.name}
                                    <span className="text-ink-faint ml-1">
                                      {substitution.explanation}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-ink-faint mt-0.5 pl-3 text-xs">
                                {t('recommendations.noSubstitutionHint')}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>

                      <div className="mt-3">
                        <Link href={`/plan?add=${result.slug}`}>
                          <Button variant="outline" size="sm">
                            <ShoppingBasket aria-hidden />
                            {t('recommendations.addMissingToList')}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
