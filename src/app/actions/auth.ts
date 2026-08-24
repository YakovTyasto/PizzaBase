'use server'

import { z } from 'zod'
import { isDemoMode, serverEnv } from '@/lib/config/env'
import type { DisplayError } from '@/lib/data/errors'
import { safeRedirectPath } from '@/lib/auth/safe-redirect'
import { ensureSessionId, clearSession } from '@/lib/data/demo/session'
import { resetOverlay } from '@/lib/data/demo/overlay'
import { readSessionId } from '@/lib/data/demo/session'
import { revalidatePath } from 'next/cache'

/**
 * Sign-in.
 *
 * There is no public sign-up. An address that is not on the allowlist is
 * refused *before* a magic link is requested, so an unknown address never
 * receives mail and never learns whether the project exists.
 *
 * The allowlist check runs here on the server. RLS remains the enforcing layer
 * for data access; this is the door, not the lock.
 */

export type SignInResult =
  { ok: true; sent: true } | { ok: false; error: DisplayError; notAllowed?: boolean }

const emailSchema = z.string().trim().toLowerCase().email().max(320)

export async function signInAction(input: {
  email: unknown
  redirectTo?: unknown
}): Promise<SignInResult> {
  const parsed = emailSchema.safeParse(input.email)
  if (!parsed.success) return { ok: false, error: 'That does not look like an email address' }

  const env = serverEnv()

  if (isDemoMode()) {
    return {
      ok: false,
      error: 'Supabase is not configured, so there is nothing to sign in to. Use demo mode.',
    }
  }

  // Refused before any mail is sent.
  if (!env.allowedEmails.includes(parsed.data)) {
    return { ok: false, error: 'This address is not on the allowlist.', notAllowed: true }
  }

  // The same check the callback applies, for the same reason: this value ends
  // up inside a link that travels through an inbox.
  const safeRedirect = safeRedirectPath(input.redirectTo)

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: {
        emailRedirectTo: `${env.appUrl}/auth/callback?next=${encodeURIComponent(safeRedirect)}`,
        // The allowlist is the only way in, so a link must never create a user.
        shouldCreateUser: false,
      },
    })
    // Supabase's own wording can name the project and the provider, so it is
    // logged rather than shown.
    if (error) {
      console.error('[signIn]', error)
      return { ok: false, error: { code: 'unknown' } }
    }
    return { ok: true, sent: true }
  } catch (error) {
    console.error('[signIn]', error)
    return { ok: false, error: { code: 'unknown' } }
  }
}

export async function signOutAction(): Promise<{ ok: boolean }> {
  if (isDemoMode()) {
    // Demo mode has no account; "signing out" ends the local session but
    // deliberately leaves the stored data, which Reset is for.
    await clearSession()
    revalidatePath('/', 'layout')
    return { ok: true }
  }

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch {
    // Already signed out.
  }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Starts (or re-enters) a demo session, so writes have somewhere to go. */
export async function enterDemoAction(): Promise<{ ok: boolean }> {
  await ensureSessionId()
  revalidatePath('/', 'layout')
  return { ok: true }
}

/**
 * Discards every local change and restores the bundled catalog.
 *
 * Destructive, so the UI confirms first. The seed itself is never touched --
 * this only drops the overlay written on top of it.
 */
export async function resetDemoDataAction(): Promise<{ ok: boolean }> {
  const sessionId = await readSessionId()
  if (sessionId) await resetOverlay(sessionId)
  revalidatePath('/', 'layout')
  return { ok: true }
}
