'use client'

import { AlertTriangle, CheckCircle2, CircleHelp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge, Card, CardBody, EmptyState } from '@/components/ui/primitives'
import type { EvidenceView, RecipeItemView } from '@/lib/data/types'

/**
 * Per-field provenance and review state.
 *
 * Conflicts are shown, never resolved automatically: when two sources disagree
 * about how much salt a dough takes, the app's job is to say so and let the
 * owner decide.
 */
export function EvidencePanel({
  evidence,
  items,
}: {
  evidence: EvidenceView[]
  items: RecipeItemView[]
}) {
  const t = useTranslations()

  if (evidence.length === 0) {
    return <EmptyState title={t('evidence.confirmed')} hint={t('evidence.title')} />
  }

  const itemsById = new Map(items.map((item) => [item.id, item]))

  const icon = (state: EvidenceView['reviewState']) => {
    if (state === 'conflict') return <AlertTriangle aria-hidden className="size-4 text-tomato" />
    if (state === 'confirmed') return <CheckCircle2 aria-hidden className="size-4 text-basil" />
    return <CircleHelp aria-hidden className="size-4 text-amber" />
  }

  return (
    <Card>
      <CardBody>
        <ul className="divide-y divide-rule">
          {evidence.map((entry) => {
            const subject = entry.itemId ? itemsById.get(entry.itemId) : null
            return (
              <li key={entry.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className="mt-0.5 shrink-0">{icon(entry.reviewState)}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-ink">
                      {subject ? subject.name.value : entry.field}
                    </span>
                    <Badge tone={entry.reviewState === 'conflict' ? 'accent' : 'warn'}>
                      {t(`evidence.${entry.reviewState}`)}
                    </Badge>
                    <span className="tabular text-xs text-ink-faint">
                      {t('evidence.confidence')} {Math.round(entry.confidence * 100)}%
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">{entry.note.value}</p>
                  {entry.reviewState === 'conflict' ? (
                    <p className="mt-1 text-xs text-ink-faint">{t('evidence.conflictHint')}</p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </CardBody>
    </Card>
  )
}
