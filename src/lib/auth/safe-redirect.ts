import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/domain'

/**
 * Where a sign-in is allowed to send you afterwards.
 *
 * `next` arrives in a URL the user can edit and, for a magic link, in one that
 * travelled through an inbox. Treating it as a destination unchecked is the
 * classic open redirect: an attacker sends `?next=https://evil.example/login`,
 * the victim signs in on the real site, and the site hands them to a
 * convincing fake.
 *
 * `value.startsWith('/')` looks like it settles that and does not.
 * `//evil.example` starts with a slash and is a protocol-relative URL, so
 * `new URL('//evil.example', origin)` resolves to `https://evil.example`. The
 * WHATWG parser also treats a backslash as a slash for http(s), which makes
 * `/\evil.example` the same attack differently spelled, and it strips tabs and
 * newlines before parsing, which makes `/\t/evil.example` a third spelling.
 *
 * So the test is not what the string looks like but where it resolves: parse
 * it against a base that cannot occur in the wild and keep it only if the
 * origin did not move.
 */

/** A base no real deployment can be served from, so a match proves same-origin. */
const PROBE_ORIGIN = 'https://impasto.invalid'

/**
 * Where the sign-in remembers the page you were heading for.
 *
 * Not a query parameter on the callback URL, because that URL has to match
 * Supabase's Redirect URLs list *exactly*: an entry of
 * `https://example.com/auth/callback` does not match
 * `https://example.com/auth/callback?next=/ru/recipes`, and Supabase silently
 * substitutes the Site URL instead -- so the link lands on the home page, the
 * code is never exchanged, and no session is created. Verified against the
 * real project, where the query-less form is honoured and the one with a query
 * is not.
 *
 * A cookie sidesteps the list entirely, and costs nothing in reach: the PKCE
 * flow already requires the link to be opened in the browser that asked for it,
 * because the code verifier lives there too. Where that does not hold, both
 * fall back together and the callback sends you to the home page in your own
 * language.
 */
export const AUTH_NEXT_COOKIE = 'impasto_auth_next'

/** Long enough to read an email, short enough not to linger. */
export const AUTH_NEXT_MAX_AGE_SECONDS = 15 * 60

/** Tabs, newlines and other control characters the URL parser would remove. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

export function safeRedirectPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || value === '') return fallback

  // An absolute or scheme-relative URL is never a local path.
  if (!value.startsWith('/')) return fallback
  if (/^[/\\]{2}/.test(value)) return fallback
  if (CONTROL_CHARACTERS.test(value)) return fallback

  try {
    const url = new URL(value, PROBE_ORIGIN)
    if (url.origin !== PROBE_ORIGIN) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

/**
 * The locale a path is in, so someone can be sent back to a page in their own
 * language. Falls back to the default rather than guessing from headers: this
 * runs on a redirect, where being wrong is cheap and being slow is not.
 */
export function localeOfPath(path: string | null | undefined): Locale {
  const first = (path ?? '').split('/')[1]
  return (LOCALES as readonly string[]).includes(first ?? '') ? (first as Locale) : DEFAULT_LOCALE
}

/**
 * The localized login page, with a reason.
 *
 * The callback lives outside the locale tree, so it builds this itself.
 * Redirecting to a bare `/login` would only work because the proxy would
 * bounce it onwards -- an extra round trip to a route that does not exist.
 */
export function loginPathFor(locale: Locale, error?: string): string {
  return error ? `/${locale}/login?error=${encodeURIComponent(error)}` : `/${locale}/login`
}
