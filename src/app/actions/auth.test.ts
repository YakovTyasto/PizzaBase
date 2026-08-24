import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Sign-in, exercised against a mocked Supabase client.
 *
 * The point of these tests is the door policy, not the mail transport: an
 * address that is not on the allowlist must be refused *before* anything is
 * sent, and a magic link must never be able to create an account.
 */

const signInWithOtp = vi.fn()
const signOut = vi.fn()
const exchangeCodeForSession = vi.fn()

const env = {
  demoMode: false,
  allowedEmails: ['owner@example.com'],
  appUrl: 'https://example.test',
}

vi.mock('@/lib/config/env', () => ({
  isDemoMode: () => env.demoMode,
  serverEnv: () => env,
  isEmailAllowed: (email: string) => env.allowedEmails.includes(email.trim().toLowerCase()),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { signInWithOtp, signOut, exchangeCodeForSession },
  }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const cookieStore = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name) } : undefined,
    set: (name: string, value: string) => cookieStore.set(name, value),
    delete: (name: string) => cookieStore.delete(name),
  }),
}))

vi.mock('@/lib/data/demo/session', () => ({
  ensureSessionId: vi.fn(async () => 'session-1'),
  readSessionId: vi.fn(async () => 'session-1'),
  clearSession: vi.fn(async () => {}),
}))

vi.mock('@/lib/data/demo/overlay', () => ({ resetOverlay: vi.fn(async () => {}) }))

const { enterDemoAction, signInAction, signOutAction } = await import('./auth')
const { GET } = await import('@/app/auth/callback/route')

beforeEach(() => {
  vi.clearAllMocks()
  cookieStore.clear()
  env.demoMode = false
  env.allowedEmails = ['owner@example.com']
  signInWithOtp.mockResolvedValue({ error: null })
  signOut.mockResolvedValue({ error: null })
})

describe('magic-link sign-in', () => {
  it('sends a link to an allowed address', async () => {
    const result = await signInAction({ email: 'owner@example.com', redirectTo: '/plan' })

    expect(result).toEqual({ ok: true, sent: true })
    expect(signInWithOtp).toHaveBeenCalledTimes(1)
    const call = signInWithOtp.mock.calls[0]![0]
    expect(call.email).toBe('owner@example.com')
    // No public sign-up: a link must never mint an account.
    expect(call.options.shouldCreateUser).toBe(false)
    // No query string: Supabase matches this against its Redirect URLs list
    // exactly, and an appended `?next=` makes it fall back to the Site URL --
    // a link that lands on the home page and signs nobody in.
    expect(call.options.emailRedirectTo).toBe('https://example.test/auth/callback')
    // The destination travels in a cookie instead.
    expect(cookieStore.get('impasto_auth_next')).toBe('/plan')
  })

  it('normalises case and surrounding space before checking', async () => {
    const result = await signInAction({ email: '  Owner@Example.com ' })
    expect(result.ok).toBe(true)
  })

  it('refuses an address that is not on the list, without sending mail', async () => {
    const result = await signInAction({ email: 'stranger@example.com' })

    expect(result).toMatchObject({ ok: false, notAllowed: true })
    expect(signInWithOtp).not.toHaveBeenCalled()
  })

  it('rejects something that is not an address', async () => {
    expect(await signInAction({ email: 'not-an-email' })).toMatchObject({ ok: false })
    expect(signInWithOtp).not.toHaveBeenCalled()
  })

  it('never redirects off-site, whatever was asked for', async () => {
    await signInAction({ email: 'owner@example.com', redirectTo: 'https://evil.test/steal' })
    const call = signInWithOtp.mock.calls[0]![0]
    expect(call.options.emailRedirectTo).toBe('https://example.test/auth/callback')
    // The remembered path is sanitised before it is stored, not after.
    expect(cookieStore.get('impasto_auth_next')).toBe('/')
  })

  it('refuses every off-site spelling when remembering where to return', async () => {
    for (const attack of ['//evil.test', '/\\evil.test', 'https://evil.test']) {
      cookieStore.clear()
      await signInAction({ email: 'owner@example.com', redirectTo: attack })
      expect(cookieStore.get('impasto_auth_next'), attack).toBe('/')
    }
  })

  it('reports a provider failure rather than claiming the mail was sent', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'rate limited' } })
    // The provider's own wording can name the project and the auth backend, so
    // it stays in the server log and the caller gets a code to translate.
    expect(await signInAction({ email: 'owner@example.com' })).toEqual({
      ok: false,
      error: { code: 'unknown' },
    })
  })

  it('says plainly that demo mode has nothing to sign in to', async () => {
    env.demoMode = true
    const result = await signInAction({ email: 'owner@example.com' })
    expect(result.ok).toBe(false)
    expect(signInWithOtp).not.toHaveBeenCalled()
  })
})

describe('magic-link callback', () => {
  function callbackRequest(query: string, cookie?: string) {
    return new Request(
      `https://example.test/auth/callback${query}`,
      cookie ? { headers: { cookie } } : undefined,
    )
  }

  it('lets an allowed address through to the page it came from', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: { email: 'owner@example.com' } },
      error: null,
    })

    const response = await GET(callbackRequest('?code=abc&next=%2Fplan'))
    expect(response.headers.get('location')).toBe('https://example.test/plan')
    expect(signOut).not.toHaveBeenCalled()
  })

  it('signs out an address that has since been removed from the list', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: { email: 'removed@example.com' } },
      error: null,
    })

    const response = await GET(callbackRequest('?code=abc'))
    // A link is a bearer token; the list is re-checked when it is used.
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(response.headers.get('location')).toContain('/login?error=not_allowed')
  })

  it('refuses to be an open redirect', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: { email: 'owner@example.com' } },
      error: null,
    })

    // Every spelling of "somewhere else", including the ones that begin with a
    // slash and so survive a `startsWith('/')` check.
    for (const attack of [
      'https://evil.test',
      '//evil.test',
      '/\\evil.test',
      '////evil.test',
      'javascript:alert(1)',
    ]) {
      const response = await GET(callbackRequest(`?code=abc&next=${encodeURIComponent(attack)}`))
      // The default locale's home page: a route that exists, rather than `/`,
      // which only ever worked because the proxy bounced it onwards.
      expect(response.headers.get('location'), attack).toBe('https://example.test/ru')
    }
  })

  it('sends the owner to the localized page they asked for', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: { email: 'owner@example.com' } },
      error: null,
    })

    const response = await GET(callbackRequest('?code=abc&next=%2Fen%2Frecipes'))
    expect(response.headers.get('location')).toBe('https://example.test/en/recipes')
  })

  it('sends a failure back to the login page in the right language', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: { message: 'expired' } })

    // The callback is outside the locale tree, so it has to build this itself.
    const response = await GET(callbackRequest('?code=abc&next=%2Ffr%2Fplan'))
    expect(response.headers.get('location')).toBe(
      'https://example.test/fr/login?error=exchange_failed',
    )
  })

  it('sends a failed exchange back to sign-in', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: { message: 'expired' } })
    const response = await GET(callbackRequest('?code=abc'))
    expect(response.headers.get('location')).toContain('error=exchange_failed')
  })

  it('uses the remembered destination when the URL carries no next', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: { email: 'owner@example.com' } },
      error: null,
    })

    // The shape production actually sees: Supabase appends only `code`,
    // because the callback URL must match its Redirect URLs list exactly.
    const response = await GET(callbackRequest('?code=abc', 'impasto_auth_next=%2Fen%2Fplan'))
    expect(response.headers.get('location')).toBe('https://example.test/en/plan')
  })

  it('prefers an explicit next over the remembered one', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: { email: 'owner@example.com' } },
      error: null,
    })

    const response = await GET(
      callbackRequest('?code=abc&next=%2Ffr%2Frecipes', 'impasto_auth_next=%2Fen%2Fplan'),
    )
    expect(response.headers.get('location')).toBe('https://example.test/fr/recipes')
  })

  it('will not follow a remembered destination that leaves the site', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: { email: 'owner@example.com' } },
      error: null,
    })

    // A cookie is not more trusted than a query parameter.
    const response = await GET(callbackRequest('?code=abc', 'impasto_auth_next=%2F%2Fevil.test'))
    expect(response.headers.get('location')).toBe('https://example.test/ru')
  })

  it('clears the remembered destination once it has been used', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: { email: 'owner@example.com' } },
      error: null,
    })

    const response = await GET(callbackRequest('?code=abc', 'impasto_auth_next=%2Fen%2Fplan'))
    // Set to empty with an immediate expiry, which is how a cookie is removed.
    expect(response.headers.get('set-cookie') ?? '').toContain('impasto_auth_next=')
  })

  it('rejects a callback with no code at all', async () => {
    const response = await GET(callbackRequest(''))
    expect(response.headers.get('location')).toContain('error=missing_code')
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })
})

describe('demo entry', () => {
  it('starts a local session so writes have somewhere to go', async () => {
    const { ensureSessionId } = await import('@/lib/data/demo/session')
    await enterDemoAction()
    expect(ensureSessionId).toHaveBeenCalled()
  })

  it('signing out of demo ends the session but keeps the data', async () => {
    env.demoMode = true
    const { clearSession } = await import('@/lib/data/demo/session')
    const { resetOverlay } = await import('@/lib/data/demo/overlay')

    await signOutAction()

    expect(clearSession).toHaveBeenCalled()
    // Signing out is not a reset: the recipes stay.
    expect(resetOverlay).not.toHaveBeenCalled()
  })
})
