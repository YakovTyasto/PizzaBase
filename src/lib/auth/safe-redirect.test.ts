import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { LOCALES } from '@/domain'
import { localeOfPath, loginPathFor, safeRedirectPath } from './safe-redirect'

/**
 * The magic-link callback, and the two ways it can go wrong.
 *
 * The outage: `/auth/callback` was matched by the proxy, so next-intl -- which
 * runs with `localePrefix: 'always'` -- redirected it to `/ru/auth/callback`.
 * That route does not exist and never did, the PKCE code was therefore never
 * exchanged, no session cookie was set, and every page then looked empty
 * because RLS correctly returns nothing to a caller who is not signed in. The
 * symptom was a bare library; the cause was one missing word in a regex.
 *
 * The latent one: `next` is a destination taken from a URL the user can edit
 * and, for a magic link, one that arrived by email. It has to be checked, and
 * `startsWith('/')` is not the check it looks like.
 */

describe('where a sign-in may send you afterwards', () => {
  it('keeps an ordinary same-origin path', () => {
    expect(safeRedirectPath('/ru/recipes')).toBe('/ru/recipes')
    expect(safeRedirectPath('/en/recipes/margherita-user')).toBe('/en/recipes/margherita-user')
    expect(safeRedirectPath('/ru/recipes?type=dough')).toBe('/ru/recipes?type=dough')
    expect(safeRedirectPath('/ru/recipes#steps')).toBe('/ru/recipes#steps')
  })

  it('refuses an absolute URL, whatever the scheme', () => {
    for (const attack of [
      'https://evil.example/login',
      'http://evil.example',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'HTTPS://EVIL.EXAMPLE',
    ]) {
      expect(safeRedirectPath(attack), attack).toBe('/')
    }
  })

  it('refuses a protocol-relative URL, which starts with a slash and leaves the site', () => {
    // The whole reason a `startsWith('/')` check is not enough: every one of
    // these resolves to a different origin.
    for (const attack of [
      '//evil.example',
      '//evil.example/login',
      '/\\evil.example',
      '/\\/evil.example',
      '//\\evil.example',
    ]) {
      expect(safeRedirectPath(attack), attack).toBe('/')
    }
  })

  it('keeps a percent-encoded backslash, which never leaves this origin', () => {
    // Not an attack: the parser does not decode %5C before resolving, so this
    // is an ordinary same-origin path with an odd name. Refusing it would be
    // superstition rather than security.
    expect(safeRedirectPath('/%5Cevil.example')).toBe('/%5Cevil.example')
    expect(new URL('/%5Cevil.example', 'https://impasto.example').origin).toBe(
      'https://impasto.example',
    )
  })

  it('refuses control characters the URL parser would strip', () => {
    // A tab or newline inside the string is removed before parsing, so
    // "/\t/evil.example" reaches the parser as "//evil.example".
    for (const attack of ['/\t/evil.example', '/\n/evil.example', '/\r/evil.example']) {
      expect(safeRedirectPath(attack), JSON.stringify(attack)).toBe('/')
    }
  })

  it('refuses anything that is not a non-empty string', () => {
    for (const attack of [undefined, null, '', 42, {}, [], true]) {
      expect(safeRedirectPath(attack)).toBe('/')
    }
  })

  it('never returns a value that resolves off-origin', () => {
    const attacks = [
      '//evil.example',
      '/\\evil.example',
      'https://evil.example',
      '/\t//evil.example',
      '////evil.example',
    ]
    for (const attack of attacks) {
      const resolved = new URL(safeRedirectPath(attack), 'https://impasto.example')
      expect(resolved.origin, attack).toBe('https://impasto.example')
    }
  })

  it('honours the caller-supplied fallback', () => {
    expect(safeRedirectPath('https://evil.example', '/ru')).toBe('/ru')
    expect(safeRedirectPath(null, '/fr/recipes')).toBe('/fr/recipes')
  })
})

describe('which language to answer in', () => {
  it('reads the locale out of the path it was asked to return to', () => {
    expect(localeOfPath('/ru/recipes')).toBe('ru')
    expect(localeOfPath('/en/plan')).toBe('en')
    expect(localeOfPath('/fr')).toBe('fr')
  })

  it('falls back to the default rather than guessing', () => {
    expect(localeOfPath('/')).toBe('ru')
    expect(localeOfPath('/recipes')).toBe('ru')
    expect(localeOfPath(null)).toBe('ru')
    expect(localeOfPath('/de/recipes')).toBe('ru')
  })

  it('builds a login path that exists, in every locale', () => {
    for (const locale of LOCALES) {
      expect(loginPathFor(locale)).toBe(`/${locale}/login`)
      expect(loginPathFor(locale, 'exchange_failed')).toBe(`/${locale}/login?error=exchange_failed`)
    }
  })

  it('escapes the reason rather than pasting it into the query', () => {
    expect(loginPathFor('ru', 'a&b=c')).toBe('/ru/login?error=a%26b%3Dc')
  })
})

/**
 * The regex that took sign-in down.
 *
 * Read out of `proxy.ts` and executed, rather than eyeballed: the failure was
 * that a path everyone assumed was excluded was not, and only running it says
 * which is which.
 */
describe('what the proxy hands to next-intl', () => {
  const source = readFileSync(path.join(process.cwd(), 'src', 'proxy.ts'), 'utf8')
  // The matcher is a *JavaScript string literal* in the source, so a doubled
  // backslash there is a single one in the regex it becomes. Reading it back
  // without undoing that escaping tests a pattern the proxy never uses.
  const literal = /matcher: \[\s*'([^']+)'/.exec(source)?.[1]
  const pattern = literal?.replaceAll('\\\\', '\\')
  const matches = (pathname: string) => new RegExp(`^${pattern}$`).test(pathname)

  it('finds the matcher to test', () => {
    expect(pattern).toBeTruthy()
    expect(pattern).toContain('auth')
  })

  it('leaves the auth callback alone, so it is never prefixed to /ru/auth/callback', () => {
    expect(matches('/auth/callback')).toBe(false)
    expect(matches('/auth/callback/')).toBe(false)
    expect(matches('/auth/anything')).toBe(false)
  })

  it('still localizes every user-facing route', () => {
    for (const pathname of [
      '/',
      '/ru',
      '/ru/recipes',
      '/en/recipes/margherita-user',
      '/fr/plan',
      '/login',
      '/ru/login',
      '/ru/settings',
    ]) {
      expect(matches(pathname), pathname).toBe(true)
    }
  })

  it('still leaves the other non-localized paths alone', () => {
    for (const pathname of ['/api/health', '/_next/static/chunk.js', '/sw.js', '/favicon.ico']) {
      expect(matches(pathname), pathname).toBe(false)
    }
  })
})
