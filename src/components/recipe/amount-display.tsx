'use client'

import { HelpCircle } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { Amount } from '@/domain'
import { formatAmount } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Renders a quantity.
 *
 * The four amount shapes look different on purpose: an unknown quantity reads
 * as a question, not as a blank or a zero, so the user can see at a glance
 * which numbers the app actually has.
 */
export function AmountDisplay({
  amount,
  className,
  showUnknownLabel = true,
}: {
  amount: Amount
  className?: string
  showUnknownLabel?: boolean
}) {
  const locale = useLocale()
  const t = useTranslations()
  const formatted = formatAmount(amount, locale)

  if (formatted.kind === 'unknown') {
    return (
      <span
        className={cn('text-amber inline-flex items-center gap-1 text-sm', className)}
        title={t('amount.unknownHint')}
      >
        <HelpCircle aria-hidden className="size-3.5" />
        {showUnknownLabel ? t('amount.unknown') : '?'}
      </span>
    )
  }

  if (formatted.kind === 'qualitative' && formatted.unit) {
    return (
      <span className={cn('text-ink-muted text-sm italic', className)}>
        {t(`units.${formatted.unit}`, { count: 1 })}
      </span>
    )
  }

  return (
    <span className={cn('tabular text-ink text-sm', className)}>
      <span className="font-medium">{formatted.value}</span>
      {formatted.unit ? (
        // A real space, not just a margin: the amount should read as "75 ml"
        // when selected, copied or announced by a screen reader.
        <>
          {' '}
          <span className="text-ink-muted">
            {t(`units.${formatted.unit}`, { count: formatted.count })}
          </span>
        </>
      ) : null}
    </span>
  )
}
