import { afterEach, describe, expect, it, vi } from 'vitest'
import { AI_LIMITS, checkRate, rateKeyFor, resetRateLimits } from './rate'

afterEach(() => {
  resetRateLimits()
  vi.useRealTimers()
})

describe('per-owner rate limiting on paid calls', () => {
  it('allows calls up to the limit', () => {
    const limit = AI_LIMITS.vision!.limit
    for (let i = 0; i < limit; i += 1) {
      expect(checkRate('vision', 'owner-a').allowed).toBe(true)
    }
  })

  it('refuses the one after, and says how long to wait', () => {
    const limit = AI_LIMITS.vision!.limit
    for (let i = 0; i < limit; i += 1) checkRate('vision', 'owner-a')

    const verdict = checkRate('vision', 'owner-a')
    expect(verdict.allowed).toBe(false)
    // An honest message needs a number, not "try again later".
    expect(verdict.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('keeps owners apart', () => {
    const limit = AI_LIMITS.vision!.limit
    for (let i = 0; i < limit; i += 1) checkRate('vision', 'owner-a')

    // One person exhausting their budget must not lock out anyone else.
    expect(checkRate('vision', 'owner-b').allowed).toBe(true)
  })

  it('keeps kinds apart', () => {
    const limit = AI_LIMITS.vision!.limit
    for (let i = 0; i < limit; i += 1) checkRate('vision', 'owner-a')

    expect(checkRate('extraction', 'owner-a').allowed).toBe(true)
  })

  it('lets the window expire', () => {
    vi.useFakeTimers()
    const limit = AI_LIMITS.extraction!.limit
    for (let i = 0; i < limit; i += 1) checkRate('extraction', 'owner-a')
    expect(checkRate('extraction', 'owner-a').allowed).toBe(false)

    vi.advanceTimersByTime(AI_LIMITS.extraction!.windowMs + 1000)
    expect(checkRate('extraction', 'owner-a').allowed).toBe(true)
  })

  it('counts down what is left', () => {
    const first = checkRate('translation', 'owner-a')
    const second = checkRate('translation', 'owner-a')
    expect(second.remaining).toBe(first.remaining - 1)
  })
})

describe('the key the limiter stores', () => {
  it('is stable for the same identity', () => {
    expect(rateKeyFor('user-1')).toBe(rateKeyFor('user-1'))
  })

  it('does not keep the identity itself in memory', () => {
    // The map is process-wide; a raw user id has no business living there.
    expect(rateKeyFor('user-1')).not.toContain('user-1')
  })

  it('gives anonymous callers a bucket rather than a free pass', () => {
    expect(rateKeyFor(null)).toBe(rateKeyFor(null))
    expect(rateKeyFor(null)).not.toBe(rateKeyFor('user-1'))
  })
})
