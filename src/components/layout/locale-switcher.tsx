'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { LOCALES, type Locale } from '@/domain'
import { usePathname, useRouter } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

/**
 * Switches language without losing the current route: `usePathname` from the
 * i18n navigation helpers returns the path *without* its locale prefix, so
 * pushing it under a new locale lands on the same screen.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations('locale')
  const active = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div
      className={cn('inline-flex rounded-full border border-rule p-0.5', className)}
      role="group"
      aria-label={t('switchTo', { locale: '' }).trim()}
    >
      {LOCALES.map((locale: Locale) => {
        const isActive = locale === active
        return (
          <button
            key={locale}
            type="button"
            disabled={pending}
            aria-current={isActive ? 'true' : undefined}
            aria-label={t('switchTo', { locale: t(locale) })}
            onClick={() => {
              if (isActive) return
              startTransition(() => {
                // `usePathname` here already returns the resolved path minus the
                // locale prefix, so dynamic segments survive the switch.
                router.replace(pathname, { locale })
              })
            }}
            className={cn(
              'min-w-10 rounded-full px-2.5 py-1 text-xs font-semibold uppercase transition-colors',
              isActive
                ? 'bg-ink text-paper'
                : 'text-ink-muted hover:bg-paper-sunken hover:text-ink',
              pending && 'opacity-60',
            )}
          >
            {locale}
          </button>
        )
      })}
    </div>
  )
}
