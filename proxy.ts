import createIntlMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'

/**
 * Next.js 16 renamed the middleware convention to `proxy`. This handles locale
 * detection and prefixing; authentication is enforced in the server layer
 * rather than here, because proxy-level checks are optimistic by design.
 */
const handleI18n = createIntlMiddleware(routing)

export function proxy(request: Parameters<typeof handleI18n>[0]) {
  return handleI18n(request)
}

export const config = {
  // Skip API routes, Next internals, the service worker and static files.
  matcher: ['/((?!api|_next|_vercel|sw\\.js|manifest\\.webmanifest|.*\\..*).*)'],
}
