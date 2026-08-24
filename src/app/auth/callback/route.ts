import { NextResponse } from 'next/server'
import { isDemoMode, isEmailAllowed } from '@/lib/config/env'
import {
  AUTH_NEXT_COOKIE,
  localeOfPath,
  loginPathFor,
  safeRedirectPath,
} from '@/lib/auth/safe-redirect'

/**
 * The remembered destination, read straight off the request.
 *
 * `cookies()` from `next/headers` would work too, but the request already
 * carries the header and this keeps the route a pure function of it.
 */
function readNextCookie(request: Request): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null

  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === AUTH_NEXT_COOKIE) {
      try {
        return decodeURIComponent(rest.join('='))
      } catch {
        return null
      }
    }
  }
  return null
}

/**
 * Magic-link landing.
 *
 * Deliberately outside the `[locale]` tree, and excluded from the proxy in
 * `src/proxy.ts`, so it keeps the one path Supabase was told to send people to.
 * Which language to answer in comes from `next`, not from the URL of the
 * callback itself -- one route, three languages.
 *
 * The allowlist is re-checked here, not just when the link was requested: a
 * link is a bearer token, and the set of allowed addresses may have changed
 * between sending and clicking. A refused session is signed straight back out
 * so a removed address cannot keep using an old link.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  /*
   * Where to go afterwards, from the query if it is there and from the cookie
   * otherwise.
   *
   * The cookie is the path that actually runs for a magic link: Supabase
   * matches the callback against its Redirect URLs list exactly, so the URL it
   * is given carries no query of ours -- only the `code` Supabase appends. The
   * query is still read first, because a direct request may legitimately carry
   * one, and because that is the shape anyone reading the route expects.
   */
  const fromQuery = url.searchParams.get('next')
  const fromCookie = readNextCookie(request)
  const next = fromQuery ?? fromCookie

  // Only a same-origin path survives this, so the callback can never be used
  // to bounce someone off the site. See `safeRedirectPath` for the spellings
  // that a `startsWith('/')` check lets through.
  const locale = localeOfPath(next)
  const redirectTo = safeRedirectPath(next, `/${locale}`)

  /** Cleared on the way out: it has done its job and should not linger. */
  const leave = (path: string) => {
    const response = NextResponse.redirect(new URL(path, url.origin))
    response.cookies.delete(AUTH_NEXT_COOKIE)
    return response
  }
  const backToLogin = (reason: string) => leave(loginPathFor(locale, reason))

  if (isDemoMode()) {
    return leave(redirectTo)
  }
  if (!code) {
    return backToLogin('missing_code')
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user?.email) {
    return backToLogin('exchange_failed')
  }

  if (!isEmailAllowed(data.user.email)) {
    await supabase.auth.signOut()
    return backToLogin('not_allowed')
  }

  return leave(redirectTo)
}
