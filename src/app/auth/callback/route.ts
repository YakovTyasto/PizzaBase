import { NextResponse } from 'next/server'
import { isDemoMode, isEmailAllowed } from '@/lib/config/env'
import { localeOfPath, loginPathFor, safeRedirectPath } from '@/lib/auth/safe-redirect'

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
  const next = url.searchParams.get('next')

  // Only a same-origin path survives this, so the callback can never be used
  // to bounce someone off the site. See `safeRedirectPath` for the spellings
  // that a `startsWith('/')` check lets through.
  const locale = localeOfPath(next)
  const redirectTo = safeRedirectPath(next, `/${locale}`)
  const backToLogin = (reason: string) =>
    NextResponse.redirect(new URL(loginPathFor(locale, reason), url.origin))

  if (isDemoMode()) {
    return NextResponse.redirect(new URL(redirectTo, url.origin))
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

  return NextResponse.redirect(new URL(redirectTo, url.origin))
}
