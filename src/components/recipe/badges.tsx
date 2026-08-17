'use client'

import { AlertTriangle, Languages } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { AuthenticityClass, Locale, RecipeStatus } from '@/domain'
import { Badge } from '@/components/ui/primitives'
import type { LocalizedText } from '@/lib/data/types'

export function StatusBadge({ status }: { status: RecipeStatus }) {
  const t = useTranslations('status')
  const tone =
    status === 'verified'
      ? 'good'
      : status === 'needs_review'
        ? 'warn'
        : status === 'archived'
          ? 'outline'
          : 'neutral'
  return <Badge tone={tone}>{t(status)}</Badge>
}

/**
 * The authenticity class carries a tooltip explaining what it claims, because
 * the difference between "traditional" and "my recipe" is the whole point of
 * the classification and should not be folk knowledge.
 */
export function AuthenticityBadge({ value }: { value: AuthenticityClass }) {
  const t = useTranslations('authenticity')
  const tone = value === 'traditional' || value === 'pizzaiolo' ? 'accent' : 'outline'
  return (
    <Badge tone={tone} title={t(`${value}Hint`)}>
      {t(value)}
    </Badge>
  )
}

/** Shown whenever the text on screen is not in the locale the user asked for. */
export function FallbackBadge({ text }: { text: LocalizedText }) {
  const t = useTranslations()
  const tLocale = useTranslations('locale')
  if (!text.fallbackFrom) return null

  return (
    <span
      className="ml-1.5 inline-flex items-center gap-1 align-middle text-[0.6875rem] text-ink-faint"
      title={t('fallback.hint', {
        requested: '',
        shown: tLocale(text.fallbackFrom as Locale),
      })}
    >
      <Languages aria-hidden className="size-3" />
      {(text.fallbackFrom as string).toUpperCase()}
    </span>
  )
}

/** Count of unknown amounts and unresolved source conflicts. */
export function ReviewBadge({
  openQuestions,
  hasConflict,
}: {
  openQuestions: number
  hasConflict: boolean
}) {
  const t = useTranslations()
  if (openQuestions === 0 && !hasConflict) return null

  return (
    <Badge tone="warn" title={hasConflict ? t('evidence.conflictHint') : t('amount.unknownHint')}>
      <AlertTriangle aria-hidden className="size-3" />
      {hasConflict ? t('evidence.conflict') : openQuestions}
    </Badge>
  )
}
