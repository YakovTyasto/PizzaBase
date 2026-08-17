import { NextResponse } from 'next/server'
import { isDemoMode, isEmailAllowed } from '@/lib/config/env'

/**
 * Magic-link landing.
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
  // Only same-origin paths, so the callback cannot be used as an open redirect.
  const redirectTo = next && next.startsWith('/') ? next : '/'

  if (isDemoMode()) {
    return NextResponse.redirect(new URL(redirectTo, url.origin))
  }
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', url.origin))
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user?.email) {
    return NextResponse.redirect(new URL('/login?error=exchange_failed', url.origin))
  }

  if (!isEmailAllowed(data.user.email)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=not_allowed', url.origin))
  }

  return NextResponse.redirect(new URL(redirectTo, url.origin))
}
