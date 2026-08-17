'use client'

import { CheckCircle2, ShoppingBasket } from 'lucide-react'
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
          <span className="block text-xs text-ink-faint">
            {t('recommendations.includeExperimentalHint')}
          </span>
        </span>
      </label>

      {results.length === 0 ? (
        <EmptyState
          title={t('recommendations.empty')}
          hint={t('recommendations.emptyHint')}
        />
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
                        className="font-display text-lg font-semibold text-ink underline-offset-4 hover:underline"
                      >
                        {result.name}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {result.styleName ? (
                          <span className="text-xs text-ink-faint">{result.styleName}</span>
                        ) : null}
                        {result.authenticity ? (
                          <Badge tone="outline">
                            {t(`authenticity.${result.authenticity}`)}
                          </Badge>
                        ) : null}
                      </p>
                    </div>
                    {result.canCookNow ? (
                      <Badge tone="good">
                        <CheckCircle2 aria-hidden className="size-3" />
                        {t('recommendations.canCookNow')}
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
                        {t('recommendations.reasonCoverage', { percent: result.coverage })}
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

                  {result.missing.length > 0 ? (
                    <div className="border-t border-rule pt-3">
                      <p className="mb-1.5 text-xs font-medium tracking-wide text-ink-muted uppercase">
                        {t('recommendations.missing')}
                      </p>
                      <ul className="space-y-2">
                        {result.missing.map((missing) => (
                          <li key={missing.ingredientId} className="text-sm">
                            <span className="text-ink">{missing.name}</span>
                            {missing.short ? (
                              <span className="ml-2 text-ink-muted">
                                <AmountDisplay
                                  amount={deserializeAmount(missing.short)}
                                  className="text-xs"
                                />
                              </span>
                            ) : null}

                            {missing.substitutions.length > 0 ? (
                              <ul className="mt-1 space-y-0.5 pl-3">
                                {missing.substitutions.map((substitution) => (
                                  <li key={substitution.name} className="text-xs text-ink-muted">
                                    → {substitution.name}
                                    <span className="ml-1 text-ink-faint">
                                      {substitution.explanation}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-0.5 pl-3 text-xs text-ink-faint">
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
