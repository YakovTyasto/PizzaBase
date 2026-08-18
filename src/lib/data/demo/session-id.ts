/**
 * The demo session cookie's name and shape.
 *
 * Split out from `session.ts` so the proxy can mint the id without importing
 * `server-only` code: the proxy runs before the server layer and may not pull
 * in `next/headers`.
 */

export const DEMO_SESSION_COOKIE = 'impasto_demo_session'

const ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/

export function isValidSessionId(value: string): boolean {
  return ID_PATTERN.test(value)
}
