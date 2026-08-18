import 'server-only'
import { createHash } from 'node:crypto'

/**
 * Per-owner limits on the calls that cost money.
 *
 * Every AI-backed action here is started by a deliberate gesture -- pressing
 * Analyse, Translate, Scan -- so a runaway is not the normal case. It is the
 * abnormal one this guards: a stuck retry loop, a page left holding the
 * button, a shared deployment where one person can spend everyone's budget.
 *
 * The counter is per server instance and in memory. That is a real limitation
 * and it is the right trade here: a shared store would be another dependency
 * to run, and the failure it prevents -- unbounded spend from one session --
 * is already prevented by a per-instance cap. It is documented rather than
 * quietly assumed.
 */

interface Window {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()

export interface RateLimit {
  /** Calls allowed inside the window. */
  limit: number
  windowMs: number
}

export const AI_LIMITS: Record<string, RateLimit> = {
  // Extraction is the expensive one: a long transcript, a large completion.
  extraction: { limit: 20, windowMs: 60 * 60 * 1000 },
  // Vision is billed per image and invites repeat attempts on a bad photo.
  vision: { limit: 30, windowMs: 60 * 60 * 1000 },
  // Translation is small but fires per field, so the field count is the risk.
  translation: { limit: 200, windowMs: 60 * 60 * 1000 },
}

export interface RateVerdict {
  allowed: boolean
  /** Seconds until the window resets, for an honest message. */
  retryAfterSeconds: number
  remaining: number
}

export function checkRate(kind: keyof typeof AI_LIMITS, owner: string): RateVerdict {
  const config = AI_LIMITS[kind]!
  const key = `${kind}:${owner}`
  const now = Date.now()

  const existing = windows.get(key)
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true, retryAfterSeconds: 0, remaining: config.limit - 1 }
  }

  if (existing.count >= config.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
      remaining: 0,
    }
  }

  existing.count += 1
  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: config.limit - existing.count,
  }
}

/** Test hook; the window map is process-wide and would otherwise leak between cases. */
export function resetRateLimits(): void {
  windows.clear()
}

/**
 * A stable, non-identifying key for the caller.
 *
 * Hashed because this ends up in a process-wide map: a limiter has no business
 * holding a raw user id or session token in memory any longer than the request.
 */
export function rateKeyFor(identity: string | null): string {
  return createHash('sha256')
    .update(identity ?? 'anonymous')
    .digest('hex')
    .slice(0, 24)
}
