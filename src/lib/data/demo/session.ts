import 'server-only'
import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'

/**
 * Demo-mode session identity.
 *
 * The cookie holds a single opaque id and nothing else -- the recipes, plan and
 * pantry live server-side keyed by it. That keeps the cookie far below the 4 KB
 * browser limit no matter how large the owner's catalog grows, and it means a
 * browser restart still finds the same data.
 */

const COOKIE_NAME = 'impasto_demo_session'
const ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/

export function isValidSessionId(value: string): boolean {
  return ID_PATTERN.test(value)
}

/** Reads the current session id, or null when this browser has none yet. */
export async function readSessionId(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE_NAME)?.value
  return value && isValidSessionId(value) ? value : null
}

/**
 * Reads the session id, minting one if needed.
 *
 * Only callable from a Server Action or Route Handler: Next.js forbids setting
 * cookies while rendering, which is the right constraint since a read must
 * never mutate. Reads use `readSessionId` and fall back to the seed.
 */
export async function ensureSessionId(): Promise<string> {
  const existing = await readSessionId()
  if (existing) return existing

  const id = randomUUID().replace(/-/g, '')
  const store = await cookies()
  store.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return id
}

export async function clearSession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
