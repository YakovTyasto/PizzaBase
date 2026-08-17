import { DEFAULT_LOCALE, type Locale } from '@/domain'
import type { LocalizedText } from './types'

/**
 * Translation fallback: requested locale, then the content's own origin locale,
 * then English. The chain is recorded so the UI can show a badge whenever the
 * user is not reading the language they asked for -- silently serving Russian
 * to a French reader with no explanation is the thing to avoid.
 */
export function resolveText(
  translations: Partial<Record<Locale, string | undefined>>,
  requested: Locale,
  originLocale: Locale = DEFAULT_LOCALE,
): LocalizedText {
  const direct = translations[requested]?.trim()
  if (direct) return { value: direct, fallbackFrom: null }

  const origin = translations[originLocale]?.trim()
  if (origin) return { value: origin, fallbackFrom: originLocale }

  const english = translations.en?.trim()
  if (english) return { value: english, fallbackFrom: 'en' }

  // Last resort: any locale that has content at all.
  for (const [locale, value] of Object.entries(translations)) {
    const trimmed = value?.trim()
    if (trimmed) return { value: trimmed, fallbackFrom: locale as Locale }
  }
  return { value: '', fallbackFrom: null }
}

export function optionalText(
  translations: Partial<Record<Locale, string | undefined>> | undefined,
  requested: Locale,
  originLocale: Locale = DEFAULT_LOCALE,
): LocalizedText | null {
  if (!translations) return null
  const resolved = resolveText(translations, requested, originLocale)
  return resolved.value ? resolved : null
}
