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
 *
 * The query string has to be carried across by hand, because `usePathname`
 * drops it. Without that, switching language on a filtered library silently
 * cleared the filter -- the same screen, but not the same view of it.
 *
 * It is read from `window.location` at click time rather than through
 * `useSearchParams`. This switcher sits in the app shell, so a render-time
 * dependency on the query string would opt *every* page out of static
 * rendering; the value is only needed once a button is pressed, and by then
 * the browser has it.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations('locale')
  const active = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div
      className={cn('border-rule inline-flex rounded-full border p-0.5', className)}
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
              const search = typeof window === 'undefined' ? '' : window.location.search
              startTransition(() => {
                // `usePathname` here already returns the resolved path minus the
                // locale prefix, so dynamic segments survive the switch.
                router.replace(`${pathname}${search}`, { locale })
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
