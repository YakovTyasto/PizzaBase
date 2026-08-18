'use client'

import { ArrowRight, Check, Loader2, RotateCcw } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { makeVersionPrimaryAction } from '@/app/actions/versions'
import { type DisplayError, useErrorText } from '@/components/ui/action-error'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, Select } from '@/components/ui/primitives'
import { usePathname, useRouter } from '@/i18n/navigation'
import type { DiffEntry } from '@/lib/data/diff'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

interface VersionRow {
  id: string
  number: number
  createdAt: string
  isPrimary: boolean
  note: string | null
}

const GROUP_ORDER: DiffEntry['group'][] = ['general', 'dough', 'ingredients', 'steps', 'notes']

export function VersionComparison({
  slug,
  versions,
  selectedId,
  diff,
  doughBefore,
  doughAfter,
}: {
  slug: string
  versions: VersionRow[]
  selectedId: string | null
  diff: DiffEntry[]
  doughBefore: Record<string, string> | null
  doughAfter: Record<string, string> | null
}) {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<DisplayError | null>(null)
  const errorText = useErrorText()

  const select = (id: string) => {
    const next = new URLSearchParams(searchParams.toString())
    next.set('compare', id)
    startTransition(() => router.replace(`${pathname}?${next.toString()}`))
  }

  const restore = (id: string) => {
    if (!window.confirm(t('versions.restoreConfirm'))) return
    setError(null)
    startTransition(async () => {
      const result = await makeVersionPrimaryAction(id)
      if (result.ok) router.push(`/recipes/${slug}`)
      else setError(result.error)
    })
  }

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    entries: diff.filter((entry) => entry.group === group),
  })).filter((section) => section.entries.length > 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <label className="block">
            <span className="text-ink-muted mb-1.5 block text-xs font-medium">
              {t('versions.compareWith')}
            </span>
            <Select
              value={selectedId ?? ''}
              onChange={(event) => select(event.target.value)}
              disabled={pending}
            >
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {t('versions.version', { number: version.number })} ·{' '}
                  {formatDateTime(new Date(version.createdAt), locale)}
                  {version.isPrimary ? ` · ${t('versions.current')}` : ''}
                </option>
              ))}
            </Select>
          </label>

          <p className="text-ink-faint flex items-center gap-2 text-xs">
            <span>{t('versions.before')}</span>
            <ArrowRight aria-hidden className="size-3" />
            <span>{t('versions.after')}</span>
          </p>

          {selectedId ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => restore(selectedId)}
            >
              {pending ? (
                <Loader2 aria-hidden className="animate-spin" />
              ) : (
                <RotateCcw aria-hidden />
              )}
              {t('versions.restore')}
            </Button>
          ) : null}

          {error ? (
            <p role="alert" className="text-tomato text-sm">
              {errorText(error)}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {/* Baker's percentages get their own row: a 10 g water change reads very
          differently as a hydration shift. */}
      {doughBefore || doughAfter ? (
        <Card>
          <CardBody>
            <h2 className="text-ink-muted mb-2 text-sm font-semibold tracking-wide uppercase">
              {t('recipe.bakersPercentages')}
            </h2>
            <ul className="space-y-1">
              {(['hydration', 'salt', 'yeast'] as const).map((key) => {
                const before = doughBefore?.[key] ?? '—'
                const after = doughAfter?.[key] ?? '—'
                const changed = before !== after
                return (
                  <li
                    key={key}
                    className="tabular flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="text-ink-muted">{t(`recipe.${key}`)}</span>
                    <span className={cn(changed ? 'text-tomato-strong' : 'text-ink-faint')}>
                      {before} <ArrowRight aria-hidden className="inline size-3" /> {after}
                    </span>
                  </li>
                )
              })}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {grouped.length === 0 ? (
        <Card>
          <CardBody className="text-basil flex items-center gap-2 py-4 text-sm">
            <Check aria-hidden className="size-4" />
            {t('versions.noDifferences')}
          </CardBody>
        </Card>
      ) : (
        grouped.map((section) => (
          <section key={section.group}>
            <h2 className="text-ink-muted mb-2 text-sm font-semibold tracking-wide uppercase">
              {section.group === 'ingredients'
                ? t('recipe.ingredients')
                : section.group === 'steps'
                  ? t('recipe.steps')
                  : section.group === 'dough'
                    ? t('recipeType.dough')
                    : section.group === 'notes'
                      ? t('recipe.notes')
                      : t('editor.section.general')}
            </h2>
            <Card>
              <CardBody className="p-0 sm:p-0">
                <ul className="divide-rule divide-y">
                  {section.entries.map((entry, index) => (
                    <li key={index} className="px-4 py-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-ink text-sm">{entry.label}</span>
                        <Badge
                          tone={
                            entry.kind === 'added'
                              ? 'good'
                              : entry.kind === 'removed'
                                ? 'accent'
                                : 'warn'
                          }
                        >
                          {t(`versions.${entry.kind}`)}
                        </Badge>
                      </div>
                      <p className="tabular mt-0.5 text-sm">
                        <span className="text-ink-faint line-through">{entry.before ?? '—'}</span>
                        <ArrowRight aria-hidden className="text-ink-faint mx-2 inline size-3" />
                        <span className="text-ink font-medium">{entry.after ?? '—'}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </section>
        ))
      )}
    </div>
  )
}
