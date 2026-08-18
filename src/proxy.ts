import createIntlMiddleware from 'next-intl/middleware'
import { isDemoMode } from '@/lib/config/env'
import { DEMO_SESSION_COOKIE, isValidSessionId } from '@/lib/data/demo/session-id'
import { routing } from '@/i18n/routing'

/**
 * Next.js 16 renamed the middleware convention to `proxy`. This handles locale
 * detection and prefixing; authentication is enforced in the server layer
 * rather than here, because proxy-level checks are optimistic by design.
 *
 * It also mints the demo session id. Cookies cannot be set while rendering, so
 * without this the id would first appear on the response to the *write* that
 * needed it -- and a navigation racing that response would render against a
 * browser that had not stored it yet, showing a library without the recipe just
 * saved. Minting here means every request already carries an id, so reads and
 * writes always agree on which session they belong to.
 */
const handleI18n = createIntlMiddleware(routing)

export function proxy(request: Parameters<typeof handleI18n>[0]) {
  const response = handleI18n(request)

  if (isDemoMode()) {
    const existing = request.cookies.get(DEMO_SESSION_COOKIE)?.value
    if (!existing || !isValidSessionId(existing)) {
      response.cookies.set(DEMO_SESSION_COOKIE, globalThis.crypto.randomUUID().replace(/-/g, ''), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      })
    }
  }

  return response
}

export const config = {
  // Skip API routes, Next internals, the service worker and static files.
  matcher: ['/((?!api|_next|_vercel|sw\\.js|manifest\\.webmanifest|.*\\..*).*)'],
}
