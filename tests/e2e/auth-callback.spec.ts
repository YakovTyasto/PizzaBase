import { expect, test } from '@playwright/test'

/**
 * The magic-link callback, end to end.
 *
 * The outage this pins down: `/auth/callback` was matched by the proxy, so
 * next-intl -- running with `localePrefix: 'always'` -- redirected it to
 * `/ru/auth/callback`. Nothing is mounted there, so the link 404'd, the PKCE
 * code was never exchanged, no session cookie was set, and every page then
 * looked empty because RLS correctly returns nothing to a caller who is not
 * signed in. The user saw an empty library and a broken login; the cause was
 * one missing word in a regex.
 *
 * The suite runs in demo mode, where the callback short-circuits to its
 * redirect target rather than exchanging a code. That is exactly the part
 * under test here: which URL the browser lands on, and where it is sent next.
 * Whether the exchange itself works is a question for a real project, and is
 * checked against production separately.
 */

/** Follow nothing: the redirect itself is the subject. */
const noRedirect = { maxRedirects: 0 } as const

test.describe('the callback is not localized', () => {
  test('answers on /auth/callback rather than redirecting to /ru/auth/callback', async ({
    request,
  }) => {
    const response = await request.get('/auth/callback?next=%2Fru%2Frecipes', noRedirect)

    // A redirect is expected -- to the destination, never to a locale-prefixed
    // copy of the callback itself.
    expect(response.status()).toBeGreaterThanOrEqual(300)
    expect(response.status()).toBeLessThan(400)

    const location = response.headers()['location'] ?? ''
    expect(location).not.toContain('/auth/callback')
    expect(location).not.toMatch(/\/(ru|en|fr)\/auth/)
    expect(location).toContain('/ru/recipes')
  })

  test('has no localized twin: /ru/auth/callback does not exist', async ({ request }) => {
    for (const locale of ['ru', 'en', 'fr']) {
      const response = await request.get(`/${locale}/auth/callback?code=test`, noRedirect)
      // Whatever it does, it must not be a working callback. 404 is the honest
      // answer for a route nobody mounted.
      expect(response.status(), locale).toBe(404)
    }
  })

  test('reaches the handler with a code present, and is not bounced by locale', async ({
    request,
  }) => {
    // In demo mode the code is ignored, but the request must arrive here at all
    // -- which is precisely what the proxy was preventing.
    const response = await request.get(
      '/auth/callback?code=not-a-real-code&next=%2Fen%2Fplan',
      noRedirect,
    )

    expect(response.status()).toBeGreaterThanOrEqual(300)
    expect(response.status()).toBeLessThan(400)
    expect(response.headers()['location'] ?? '').toContain('/en/plan')
  })
})

test.describe('the callback refuses to be an open redirect', () => {
  const attacks = [
    'https://evil.example/login',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    '////evil.example',
  ]

  for (const attack of attacks) {
    test(`sends nobody to ${attack}`, async ({ request, baseURL }) => {
      const response = await request.get(
        `/auth/callback?next=${encodeURIComponent(attack)}`,
        noRedirect,
      )

      const location = response.headers()['location'] ?? ''
      const resolved = new URL(location, baseURL)

      // Rejected outright, so the destination is the safe fallback -- the home
      // page in the default locale -- and not the attacker's host under any
      // spelling. Comparing the whole origin would be wrong here: the server
      // answers on `localhost` while the suite addresses it as `127.0.0.1`.
      expect(resolved.hostname, attack).not.toBe('evil.example')
      expect(resolved.protocol, attack).toMatch(/^https?:$/)
      expect(resolved.pathname, attack).toBe('/ru')
      expect(location, attack).not.toContain('evil.example')
    })
  }
})

test.describe('the login page never builds a localized callback', () => {
  for (const locale of ['ru', 'en', 'fr']) {
    test(`/${locale}/login offers no link to /${locale}/auth/callback`, async ({ page }) => {
      await page.goto(`/${locale}/login`)
      await page.waitForLoadState('networkidle')

      const html = await page.content()
      // Neither rendered markup nor the serialized payload may contain one.
      expect(html).not.toContain(`/${locale}/auth/callback`)
      expect(html).not.toMatch(/\/(ru|en|fr)\/auth\/callback/)
    })
  }
})

test.describe('application routes still carry their locale', () => {
  test('a bare path is redirected to the default locale', async ({ request }) => {
    for (const [path, expected] of [
      ['/', '/ru'],
      ['/recipes', '/ru/recipes'],
      ['/login', '/ru/login'],
    ] as const) {
      const response = await request.get(path, noRedirect)
      expect(response.status(), path).toBeGreaterThanOrEqual(300)
      expect(response.headers()['location'] ?? '', path).toContain(expected)
    }
  })

  test('every locale serves its own pages', async ({ page }) => {
    for (const locale of ['ru', 'en', 'fr']) {
      const response = await page.goto(`/${locale}/recipes`)
      expect(response?.status(), locale).toBeLessThan(400)
      expect(new URL(page.url()).pathname, locale).toBe(`/${locale}/recipes`)
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
    }
  })

  test('the health endpoint is still not localized either', async ({ request }) => {
    const response = await request.get('/api/health', noRedirect)
    expect(response.status()).toBeLessThan(400)
  })
})
