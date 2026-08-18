'use client'

import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type ActionError, type DisplayError, messageKeyFor } from '@/lib/data/errors'
import { cn } from '@/lib/utils'

/**
 * Rendering a failed mutation.
 *
 * Actions answer with a code, so the sentence the user reads is written here,
 * in their language, from the app's own message catalog. Nothing that crossed
 * the wire is ever printed verbatim -- which is what keeps a server path or a
 * driver message off the page.
 *
 * A plain string is still accepted for the provider-facing flows whose text the
 * app authors itself (scan, import, translate).
 */
export type { DisplayError }

function isActionError(error: DisplayError): error is ActionError {
  return typeof error === 'object' && error !== null && 'code' in error
}

/** The translated sentence for an error, for callers that need the text alone. */
export function useErrorText(): (error: DisplayError | null | undefined) => string | null {
  const t = useTranslations()
  return (error) => {
    if (!error) return null
    if (!isActionError(error)) return error
    const message = t(messageKeyFor(error.code))
    return error.detail ? `${message} ${error.detail}` : message
  }
}

export function ActionErrorMessage({
  error,
  className,
}: {
  error: DisplayError | null | undefined
  className?: string
}) {
  const text = useErrorText()(error)
  if (!text) return null

  return (
    <p
      role="alert"
      className={cn(
        'bg-tomato-soft text-tomato-strong flex items-start gap-2 rounded-lg px-3 py-2 text-sm',
        className,
      )}
    >
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{text}</span>
    </p>
  )
}
