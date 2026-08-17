import { defineRouting } from 'next-intl/routing'
import { DEFAULT_LOCALE, LOCALES } from '@/domain'

/**
 * Every route carries its locale prefix, including the default one. A URL
 * always says which language it is in, which is what lets the language switcher
 * preserve the current route instead of bouncing to the home page.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  localeDetection: true,
})

export type AppLocale = (typeof routing.locales)[number]

export function isAppLocale(value: string): value is AppLocale {
  return (routing.locales as readonly string[]).includes(value)
}
