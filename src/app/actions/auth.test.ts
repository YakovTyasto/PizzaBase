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
    expect(call.options.emailRedirectTo).toContain('/auth/callback?next=%2Fplan')
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
    expect(call.options.emailRedirectTo).toBe(
      'https://example.test/auth/callback?next=%2F',
    )
  })

  it('reports a provider failure rather than claiming the mail was sent', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'rate limited' } })
    expect(await signInAction({ email: 'owner@example.com' })).toEqual({
      ok: false,
      error: 'rate limited',
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
  function callbackRequest(query: string) {
    return new Request(`https://example.test/auth/callback${query}`)
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

    const response = await GET(callbackRequest('?code=abc&next=https%3A%2F%2Fevil.test'))
    expect(response.headers.get('location')).toBe('https://example.test/')
  })

  it('sends a failed exchange back to sign-in', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: { message: 'expired' } })
    const response = await GET(callbackRequest('?code=abc'))
    expect(response.headers.get('location')).toContain('error=exchange_failed')
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
